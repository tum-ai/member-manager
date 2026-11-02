/**
 * Supabase Auth's OAuth 2.1 server issues access tokens to other apps (nomcp,
 * the TUM.ai Notion MCP gateway, for members' AI agents). Such a token is an
 * ordinary user JWT plus a `client_id` claim, and Supabase's `getUser`
 * accepts it like a browser session. It lets the app act as the member, so
 * member-manager refuses it everywhere: `authenticate` rejects it before
 * asking Supabase, and the `oauth_clients_blocked` RLS policies (migration
 * `20261102120000_mcp_oauth.sql`) do the same for PostgREST.
 */
export const OAUTH_CLIENT_TOKEN_ERROR =
	"Access tokens issued to connected apps can't be used with the Member Manager API";

export type BearerTokenInspection =
	| { kind: "session" }
	| { kind: "oauth_client"; clientId: string }
	| { kind: "malformed" };

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
	const segments = token.split(".");
	if (
		segments.length !== 3 ||
		!segments.every((segment) => BASE64URL_SEGMENT.test(segment))
	) {
		return null;
	}
	try {
		const payload: unknown = JSON.parse(
			Buffer.from(segments[1], "base64url").toString("utf8"),
		);
		return payload !== null &&
			typeof payload === "object" &&
			!Array.isArray(payload)
			? (payload as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/**
 * Reads a bearer token's JWT payload without verifying it; `getUser` still
 * verifies every token that passes.
 *
 * - `oauth_client`: a JWT whose payload has a non-null `client_id`, the same
 *   test the RLS policies apply (`auth.jwt() ->> 'client_id'`).
 * - `malformed`: it has a `.` but isn't three base64url segments with a JSON
 *   object payload. Rejecting it fails closed: `getUser` only ever accepts
 *   JWTs, so a token this can't read must not get through.
 * - `session`: anything else. A token without a `.` can't be a JWT, and
 *   `getUser` rejects it as it always has.
 */
export function inspectBearerToken(token: string): BearerTokenInspection {
	if (!token.includes(".")) {
		return { kind: "session" };
	}
	const payload = decodeJwtPayload(token);
	if (!payload) {
		return { kind: "malformed" };
	}
	const clientId = payload.client_id;
	if (clientId === undefined || clientId === null) {
		return { kind: "session" };
	}
	return { kind: "oauth_client", clientId: String(clientId) };
}
