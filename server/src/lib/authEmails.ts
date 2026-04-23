import { getSupabase } from "./supabase.js";

const AUTH_PAGE_SIZE = 1000;

// Vercel's built-in TS cannot resolve inherited GoTrueClient methods through
// pnpm's strict node_modules layout, so we access .admin via a cast.
function getAuthAdmin() {
	// biome-ignore lint/suspicious/noExplicitAny: works around Vercel type resolution
	return (getSupabase().auth as any).admin;
}

export async function getAuthEmail(userId: string): Promise<string> {
	const { data, error } = await getAuthAdmin().getUserById(userId);

	if (error) {
		throw new Error(`Failed to fetch auth user ${userId}: ${error.message}`);
	}

	return data.user?.email ?? "";
}

export async function getAuthEmails(
	userIds: readonly string[],
): Promise<Map<string, string>> {
	const pendingUserIds = new Set(userIds);
	const emails = new Map<string, string>();

	if (pendingUserIds.size === 0) {
		return emails;
	}

	let page = 1;

	while (pendingUserIds.size > 0) {
		const { data, error } = await getAuthAdmin().listUsers({
			page,
			perPage: AUTH_PAGE_SIZE,
		});

		if (error) {
			throw new Error(`Failed to list auth users: ${error.message}`);
		}

		const users = data.users ?? [];

		for (const user of users) {
			if (pendingUserIds.delete(user.id)) {
				emails.set(user.id, user.email ?? "");
			}
		}

		if (users.length < AUTH_PAGE_SIZE) {
			break;
		}

		page += 1;
	}

	for (const userId of pendingUserIds) {
		emails.set(userId, "");
	}

	return emails;
}

export interface AuthProfile {
	email: string;
	avatar_url: string;
}

// Slack OIDC / Supabase store the profile picture under `avatar_url` (Supabase
// normalized) or `picture` (OIDC standard). Prefer `avatar_url` when both are
// present.
function extractAvatarUrl(metadata: Record<string, unknown> | null): string {
	if (!metadata) return "";
	const candidates = [metadata.avatar_url, metadata.picture];
	for (const value of candidates) {
		if (typeof value === "string" && value.trim() !== "") {
			return value;
		}
	}
	return "";
}

export async function getAuthProfiles(
	userIds: readonly string[],
): Promise<Map<string, AuthProfile>> {
	const pendingUserIds = new Set(userIds);
	const profiles = new Map<string, AuthProfile>();

	if (pendingUserIds.size === 0) {
		return profiles;
	}

	let page = 1;

	while (pendingUserIds.size > 0) {
		const { data, error } = await getAuthAdmin().listUsers({
			page,
			perPage: AUTH_PAGE_SIZE,
		});

		if (error) {
			throw new Error(`Failed to list auth users: ${error.message}`);
		}

		const users = data.users ?? [];

		for (const user of users) {
			if (pendingUserIds.delete(user.id)) {
				profiles.set(user.id, {
					email: user.email ?? "",
					avatar_url: extractAvatarUrl(user.user_metadata ?? null),
				});
			}
		}

		if (users.length < AUTH_PAGE_SIZE) {
			break;
		}

		page += 1;
	}

	for (const userId of pendingUserIds) {
		profiles.set(userId, { email: "", avatar_url: "" });
	}

	return profiles;
}
