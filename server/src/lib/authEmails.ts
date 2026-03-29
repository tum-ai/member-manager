import { getSupabase } from "./supabase.js";

const AUTH_PAGE_SIZE = 1000;

export async function getAuthEmail(userId: string): Promise<string> {
	const { data, error } = await getSupabase().auth.admin.getUserById(userId);

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
		const { data, error } = await getSupabase().auth.admin.listUsers({
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
