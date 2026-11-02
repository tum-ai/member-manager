import { supabase } from "@/lib/supabaseClient";
import { parseScopes } from "./oauthUtils";

// The OAuth server endpoints belong to Supabase Auth, not the Fastify API, so
// these call supabase-js directly (like sign-in does) instead of apiClient.
// Each uses the member's browser session.

export const oauthQueryKeys = {
	authorization: (authorizationId: string | null) =>
		["oauth", "authorization", authorizationId] as const,
	connectedApps: ["oauth", "connected-apps"] as const,
};

export type AuthorizationRequest =
	| {
			kind: "consent";
			authorizationId: string;
			clientName: string;
			redirectUri: string;
			scopes: string[];
			userEmail: string | null;
	  }
	/** The member approved this app before; Supabase skips the consent step. */
	| { kind: "redirect"; redirectUrl: string };

export interface ConnectedApp {
	clientId: string;
	name: string;
	scopes: string[];
	grantedAt: string;
}

export type ConsentDecision = "approve" | "deny";

export async function fetchAuthorizationRequest(
	authorizationId: string,
): Promise<AuthorizationRequest> {
	const { data, error } =
		await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
	if (error) throw error;
	if ("authorization_id" in data) {
		return {
			kind: "consent",
			authorizationId: data.authorization_id,
			clientName: data.client?.name?.trim() || "An unnamed app",
			redirectUri: data.redirect_uri,
			scopes: parseScopes(data.scope),
			userEmail: data.user?.email ?? null,
		};
	}
	return { kind: "redirect", redirectUrl: data.redirect_url };
}

/** Records the member's decision; returns where Supabase sends the browser next. */
export async function submitConsentDecision(
	authorizationId: string,
	decision: ConsentDecision,
): Promise<string> {
	// The page follows the redirect itself, after checking it.
	const options = { skipBrowserRedirect: true };
	const { data, error } =
		decision === "approve"
			? await supabase.auth.oauth.approveAuthorization(authorizationId, options)
			: await supabase.auth.oauth.denyAuthorization(authorizationId, options);
	if (error) throw error;
	return data.redirect_url;
}

export async function fetchConnectedApps(): Promise<ConnectedApp[]> {
	const { data, error } = await supabase.auth.oauth.listGrants();
	if (error) throw error;
	return data.map((grant) => ({
		clientId: grant.client.id,
		name: grant.client.name?.trim() || "An unnamed app",
		scopes: grant.scopes,
		grantedAt: grant.granted_at,
	}));
}

/**
 * Revokes the member's approval. Supabase deletes the app's sessions and
 * refresh tokens; `mcp_principal()` then refuses its remaining access tokens.
 */
export async function revokeConnectedApp(clientId: string): Promise<void> {
	const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
	if (error) throw error;
}
