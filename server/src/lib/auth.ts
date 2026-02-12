import { ForbiddenError, isNotFoundError } from "./errors.js";
import { getSupabase } from "./supabase.js";

export async function checkAdminRole(userId: string): Promise<boolean> {
	const { data: roleData, error: roleError } = await getSupabase()
		.from("user_roles")
		.select("role")
		.eq("user_id", userId)
		.single();

	if (roleError && !isNotFoundError(roleError)) {
		throw roleError;
	}

	return roleData?.role === "admin";
}

export async function ensureOwnerOrAdmin(
	userId: string,
	targetId: string,
	message = "Access denied",
): Promise<void> {
	if (userId === targetId) return;

	const isAdmin = await checkAdminRole(userId);
	if (!isAdmin) {
		throw new ForbiddenError(message);
	}
}
