import type { User } from "@supabase/supabase-js";

/**
 * Only members of the TUM.ai Slack workspace may use the portal. "Sign in
 * with Slack" itself accepts any workspace, so the workspace is enforced
 * twice: `public.handle_new_user` rejects foreign sign-ups (migration
 * `20261101120000_restrict_slack_workspace.sql`, which hardcodes the same
 * ID), and `authenticate` re-checks every request via
 * {@link isAllowedWorkspaceUser}.
 *
 * Team IDs are not secret. `ALLOWED_SLACK_TEAM_IDS` (comma-separated) can
 * override the default, but a team the migration does not also allow can
 * never sign up.
 */
export const TUMAI_SLACK_TEAM_ID = "T01288YLP16";

export const SLACK_OIDC_PROVIDER = "slack_oidc";
const SLACK_TEAM_ID_CLAIM = "https://slack.com/team_id";
const LOCAL_SUPABASE_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function getAllowedSlackTeamIds(
	override: string | undefined = process.env.ALLOWED_SLACK_TEAM_IDS,
): Set<string> {
	const configured = (override ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	return new Set(configured.length > 0 ? configured : [TUMAI_SLACK_TEAM_ID]);
}

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

/**
 * Whether the authenticated user may use the API. A user who has a Slack
 * identity needs every one of those identities to come from an allowed
 * workspace. A user with no Slack identity (the seeded email/password users)
 * is accepted only against a local Supabase stack.
 */
export function isAllowedWorkspaceUser(
	user: User,
	options: {
		allowedTeamIds?: Set<string>;
		allowNonSlackUsers?: boolean;
	} = {},
): boolean {
	const allowedTeamIds = options.allowedTeamIds ?? getAllowedSlackTeamIds();
	const slackIdentities = getSlackIdentities(user);

	if (slackIdentities.length === 0) {
		return options.allowNonSlackUsers ?? isLocalSupabase();
	}

	return slackIdentities.every((identity) => {
		const teamId = readTeamId(identity.identity_data);
		return teamId !== null && allowedTeamIds.has(teamId);
	});
}
