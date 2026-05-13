import { getSupabase } from "./supabase.js";

const AUTH_PAGE_SIZE = 1000;
const AUTH_EMAIL_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;

export interface AuthProfile {
	email: string;
	avatar_url: string;
}

interface ListedAuthUser {
	id: string;
	email?: string;
	user_metadata?: Record<string, unknown> | null;
}

const authUserIdByEmailCache = new Map<
	string,
	{ userId: string | null; expiresAt: number }
>();
const authProfileByUserIdCache = new Map<
	string,
	{ profile: AuthProfile; expiresAt: number }
>();

// Vercel's built-in TS cannot resolve inherited GoTrueClient methods through
// pnpm's strict node_modules layout, so we access .admin via a cast.
function getAuthAdmin() {
	// biome-ignore lint/suspicious/noExplicitAny: works around Vercel type resolution
	return (getSupabase().auth as any).admin;
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

function readCachedAuthProfile(userId: string): AuthProfile | null {
	const cached = authProfileByUserIdCache.get(userId);
	if (!cached) {
		return null;
	}
	if (cached.expiresAt <= Date.now()) {
		authProfileByUserIdCache.delete(userId);
		return null;
	}
	return cached.profile;
}

function cacheAuthProfile(userId: string, profile: AuthProfile): void {
	authProfileByUserIdCache.set(userId, {
		profile,
		expiresAt: Date.now() + AUTH_EMAIL_LOOKUP_CACHE_TTL_MS,
	});
	const normalizedEmail = profile.email.trim().toLowerCase();
	if (normalizedEmail) {
		authUserIdByEmailCache.set(normalizedEmail, {
			userId,
			expiresAt: Date.now() + AUTH_EMAIL_LOOKUP_CACHE_TTL_MS,
		});
	}
}

function cacheListedAuthUser(user: ListedAuthUser): AuthProfile {
	const profile = {
		email: user.email ?? "",
		avatar_url: extractAvatarUrl(user.user_metadata ?? null),
	};
	cacheAuthProfile(user.id, profile);
	return profile;
}

export async function getAuthEmail(userId: string): Promise<string> {
	const cached = readCachedAuthProfile(userId);
	if (cached) {
		return cached.email;
	}

	const { data, error } = await getAuthAdmin().getUserById(userId);

	if (error) {
		throw new Error(`Failed to fetch auth user ${userId}: ${error.message}`);
	}

	const user = data.user as ListedAuthUser | null | undefined;
	return user ? cacheListedAuthUser(user).email : "";
}

export async function getAuthUserIdByEmail(
	email: string,
): Promise<string | null> {
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) {
		return null;
	}

	const cached = authUserIdByEmailCache.get(normalizedEmail);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.userId;
	}

	let page = 1;

	while (true) {
		const { data, error } = await getAuthAdmin().listUsers({
			page,
			perPage: AUTH_PAGE_SIZE,
		});

		if (error) {
			throw new Error(`Failed to list auth users: ${error.message}`);
		}

		const users = (data.users ?? []) as ListedAuthUser[];
		for (const user of users) {
			cacheListedAuthUser(user);
		}

		const match = users.find(
			(user) => user.email?.trim().toLowerCase() === normalizedEmail,
		);
		if (match?.id) {
			authUserIdByEmailCache.set(normalizedEmail, {
				userId: match.id,
				expiresAt: Date.now() + AUTH_EMAIL_LOOKUP_CACHE_TTL_MS,
			});
			return match.id;
		}

		if (users.length < AUTH_PAGE_SIZE) {
			authUserIdByEmailCache.set(normalizedEmail, {
				userId: null,
				expiresAt: Date.now() + AUTH_EMAIL_LOOKUP_CACHE_TTL_MS,
			});
			return null;
		}

		page += 1;
	}
}

export async function getAuthEmails(
	userIds: readonly string[],
): Promise<Map<string, string>> {
	const pendingUserIds = new Set(userIds);
	const emails = new Map<string, string>();

	for (const userId of pendingUserIds) {
		const cached = readCachedAuthProfile(userId);
		if (cached) {
			emails.set(userId, cached.email);
			pendingUserIds.delete(userId);
		}
	}

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

		const users = (data.users ?? []) as ListedAuthUser[];

		for (const user of users) {
			const profile = cacheListedAuthUser(user);
			if (pendingUserIds.delete(user.id)) {
				emails.set(user.id, profile.email);
			}
		}

		if (users.length < AUTH_PAGE_SIZE) {
			break;
		}

		page += 1;
	}

	for (const userId of pendingUserIds) {
		emails.set(userId, "");
		cacheAuthProfile(userId, { email: "", avatar_url: "" });
	}

	return emails;
}

export async function getAuthProfiles(
	userIds: readonly string[],
): Promise<Map<string, AuthProfile>> {
	const pendingUserIds = new Set(userIds);
	const profiles = new Map<string, AuthProfile>();

	for (const userId of pendingUserIds) {
		const cached = readCachedAuthProfile(userId);
		if (cached) {
			profiles.set(userId, cached);
			pendingUserIds.delete(userId);
		}
	}

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

		const users = (data.users ?? []) as ListedAuthUser[];

		for (const user of users) {
			const profile = cacheListedAuthUser(user);
			if (pendingUserIds.delete(user.id)) {
				profiles.set(user.id, profile);
			}
		}

		if (users.length < AUTH_PAGE_SIZE) {
			break;
		}

		page += 1;
	}

	for (const userId of pendingUserIds) {
		const emptyProfile = { email: "", avatar_url: "" };
		profiles.set(userId, emptyProfile);
		cacheAuthProfile(userId, emptyProfile);
	}

	return profiles;
}
