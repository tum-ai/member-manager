import { memberHasPermission, type Permission } from "@member-manager/shared";
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

// Department-scoped RBAC: admins are superusers; otherwise the member's
// department must grant the permission (and the member must be active). The
// department→permission map lives in @member-manager/shared so the client and
// server stay in sync.
export async function checkDepartmentPermission(
	userId: string,
	permission: Permission,
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

	return memberHasPermission(
		data as {
			department?: string | null;
			member_status?: string | null;
			active?: boolean | null;
		},
		permission,
	);
}

export async function checkReimbursementReviewer(
	userId: string,
): Promise<boolean> {
	return checkDepartmentPermission(userId, "finance.review");
}

export async function checkLegalFinanceRole(userId: string): Promise<boolean> {
	return checkDepartmentPermission(userId, "contracts.admin");
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
