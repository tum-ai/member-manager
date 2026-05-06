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

export async function checkReimbursementReviewer(
	userId: string,
): Promise<boolean> {
	if (await checkAdminRole(userId)) {
		return true;
	}

	const { data, error } = await getSupabase()
		.from("members")
		.select("department, member_status, active")
		.eq("user_id", userId)
		.single();

	if (error) {
		if (isNotFoundError(error)) {
			return false;
		}
		throw error;
	}

	const member = data as {
		department?: string | null;
		member_status?: string | null;
		active?: boolean | null;
	};
	const memberStatus =
		member.member_status ?? (member.active ? "active" : "inactive");

	return member.department === "Legal & Finance" && memberStatus === "active";
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
