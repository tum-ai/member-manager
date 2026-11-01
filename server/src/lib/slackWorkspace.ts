import type { User } from "@supabase/supabase-js";

/**
 * Only members of the TUM.ai Slack workspace may use the portal. "Sign in
 * with Slack" itself accepts any workspace, so the workspace is enforced
 * twice: `public.handle_new_user` rejects foreign sign-ups (migration
 * `20261101120000_restrict_slack_workspace.sql`), and `authenticate`
 * re-checks every request via {@link isAllowedWorkspaceUser}.
 *
 * The migration hardcodes the same ID, and a migration test asserts the two
 * match. Changing the workspace means a new migration plus this constant.
 * Team IDs are not secret.
 */
export const TUMAI_SLACK_TEAM_ID = "T01288YLP16";

export const SLACK_OIDC_PROVIDER = "slack_oidc";
const SLACK_TEAM_ID_CLAIM = "https://slack.com/team_id";
const LOCAL_SUPABASE_HOSTS = new Set(["127.0.0.1", "localhost"]);

function readTeamId(data: Record<string, unknown> | undefined): string | null {
	const claims = data?.custom_claims;
	if (!claims || typeof claims !== "object") return null;
	const teamId = (claims as Record<string, unknown>)[SLACK_TEAM_ID_CLAIM];
	return typeof teamId === "string" && teamId.trim() !== ""
		? teamId.trim()
		: null;
}

function getSlackIdentities(user: User) {
	return (user.identities ?? []).filter(
		(identity) => identity.provider === SLACK_OIDC_PROVIDER,
	);
}

/**
 * Workspace team IDs of the user's Slack identities. Reads
 * `identities[].identity_data`, which only the auth server writes. It never
 * reads `user_metadata`, which users can rewrite via `auth.updateUser`.
 */
export function getSlackTeamIds(user: User): string[] {
	return getSlackIdentities(user)
		.map((identity) => readTeamId(identity.identity_data))
		.filter((teamId): teamId is string => teamId !== null);
}

/** True when the server talks to a local Supabase stack (dev and E2E). */
export function isLocalSupabase(
	supabaseUrl: string | undefined = process.env.SUPABASE_URL,
	nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
	if (nodeEnv === "production" || !supabaseUrl) return false;
	try {
		return LOCAL_SUPABASE_HOSTS.has(new URL(supabaseUrl).hostname);
	} catch {
		return false;
	}
}

let nonSlackUsersAllowed: boolean | undefined;

/**
 * Whether users without a Slack identity (the seeded email/password users)
 * may use the API: only against a local Supabase stack. Resolved on first
 * use, after the env files are loaded, then fixed for the process.
 */
export function allowsNonSlackUsers(): boolean {
	nonSlackUsersAllowed ??= isLocalSupabase();
	return nonSlackUsersAllowed;
}

/**
 * Test seam, like `setSupabaseClient`: pins {@link allowsNonSlackUsers}
 * regardless of the ambient `SUPABASE_URL`. `undefined` re-resolves it.
 */
export function setAllowNonSlackUsers(value: boolean | undefined): void {
	nonSlackUsersAllowed = value;
}

/**
 * Whether the authenticated user may use the API.
 *
 * A user passes with at least one Slack identity from the TUM.ai workspace.
 * Requiring every identity to match would lock a member out for good after
 * one sign-in through another workspace: Supabase links that identity to
 * the existing account by verified email, and `handle_new_user` does not run
 * for a link. A user whose Slack identities are all foreign is rejected. A
 * user with no Slack identity passes only when `allowNonSlackUsers` is set.
 */
export function isAllowedWorkspaceUser(
	user: User,
	allowNonSlackUsers: boolean = allowsNonSlackUsers(),
): boolean {
	const slackIdentities = getSlackIdentities(user);
	if (slackIdentities.length === 0) {
		return allowNonSlackUsers;
	}
	return slackIdentities.some(
		(identity) => readTeamId(identity.identity_data) === TUMAI_SLACK_TEAM_ID,
	);
}
