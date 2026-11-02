/**
 * Supabase Auth's OAuth 2.1 server sends members here (Site URL +
 * `authorization_url_path`, `supabase/config.toml`) to approve an app, such as
 * an AI agent connecting to nomcp, the TUM.ai Notion MCP gateway.
 */
export const OAUTH_CONSENT_PATH = "/oauth/consent";

/** Where members see and revoke the apps they approved. */
export const CONNECTED_APPS_PATH = "/connected-apps";

/**
 * The redirect URIs of the MCP clients TUM.ai supports. The consent page only
 * lets a member approve an app whose redirect URI matches, and only sends the
 * browser to a matching address with a code.
 *
 * Why: Supabase's access tokens carry `aud: "authenticated"` and no resource
 * indicator, and dynamic client registration is open. Anyone can register an
 * app under any name ("TUM.ai Event RSVP") with their own redirect URI. If a
 * member approved it, the code, and with it an access and refresh token, would
 * reach that site, which could replay them at nomcp as the member. Supabase
 * can't restrict registered redirect URIs on the server, so this list is the
 * check. The redirect URI is the one detail an app's author can't fake: the
 * code only ever goes there.
 *
 * Adding a client: add its https domain, or its own URL scheme, here; add a
 * case to `oauthUtils.test.ts`; and list it in docs/deployment.md ("OAuth
 * server (nomcp)"). Only add an address the client's vendor controls.
 */
export const APPROVED_MCP_CLIENT_REDIRECTS = {
	/** https only, subdomains included: claude.ai and Claude Desktop, ChatGPT. */
	httpsDomains: ["claude.ai", "claude.com", "chatgpt.com", "openai.com"],
	/**
	 * This computer, any port, http or https: Claude Code, the MCP Inspector
	 * and other CLI clients. A code sent here never leaves the member's machine.
	 */
	loopbackHosts: ["localhost", "127.0.0.1", "[::1]"],
	/** Desktop apps that receive the code through their own URL scheme. */
	appSchemes: ["cursor:", "vscode:", "vscode-insiders:", "windsurf:"],
} as const;

export interface RedirectTarget {
	/** What to show the member: the host, or scheme and host for app links. */
	label: string;
	/** On {@link APPROVED_MCP_CLIENT_REDIRECTS}; nothing else can be approved. */
	isApproved: boolean;
}

function isApprovedHttpsHost(hostname: string): boolean {
	return APPROVED_MCP_CLIENT_REDIRECTS.httpsDomains.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
	);
}

function isApprovedUrl(url: URL): boolean {
	const { appSchemes, loopbackHosts } = APPROVED_MCP_CLIENT_REDIRECTS;
	if (url.protocol === "https:" || url.protocol === "http:") {
		if ((loopbackHosts as readonly string[]).includes(url.hostname)) {
			return true;
		}
		return url.protocol === "https:" && isApprovedHttpsHost(url.hostname);
	}
	return (appSchemes as readonly string[]).includes(url.protocol);
}

/**
 * Describes where an app sends the member (its redirect URI, or a redirect
 * URL Supabase returned) and whether that is an approved MCP client.
 */
export function describeRedirectTarget(redirectUri: string): RedirectTarget {
	let url: URL;
	try {
		url = new URL(redirectUri);
	} catch {
		return { label: redirectUri, isApproved: false };
	}
	const isWeb = url.protocol === "https:" || url.protocol === "http:";
	return {
		label: isWeb ? url.host : `${url.protocol}//${url.host}`,
		isApproved: isApprovedUrl(url),
	};
}

/** The `authorization_id` Supabase appends to the consent URL, if any. */
export function readAuthorizationId(search: string): string | null {
	return new URLSearchParams(search).get("authorization_id")?.trim() || null;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
	openid: "Confirm who you are",
	email: "See your email address",
	profile: "See your name and profile picture",
	phone: "See your phone number",
};

/** Supabase sends scopes space-separated; returns them de-duplicated. */
export function parseScopes(scope: string | null | undefined): string[] {
	return [...new Set((scope ?? "").split(/\s+/).filter(Boolean))];
}

export function describeScope(scope: string): string {
	return SCOPE_DESCRIPTIONS[scope] ?? scope;
}

/** "2 Nov 2026" for a grant timestamp; the raw value if it doesn't parse. */
export function formatGrantedAt(grantedAt: string): string {
	const date = new Date(grantedAt);
	return Number.isNaN(date.getTime())
		? grantedAt
		: date.toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
}
