import { isActiveMember, type Permission } from "@member-manager/shared";
import { fetchDepartmentPermissions } from "./departmentPermissions.js";
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

// Department-scoped RBAC: admins are superusers; otherwise the member must be
// active and their department must grant the permission. The department→
// permission mapping lives in the `department_permissions` table, edited by
// admins through the admin UI.
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

	const member = data as {
		department?: string | null;
		member_status?: string | null;
		active?: boolean | null;
	};

	if (!isActiveMember(member) || !member.department) {
		return false;
	}

	const granted = await fetchDepartmentPermissions(member.department);
	return granted.includes(permission);
}

export async function checkReimbursementReviewer(
	userId: string,
): Promise<boolean> {
	return checkDepartmentPermission(userId, "finance.review");
}

export async function checkContractsAdmin(userId: string): Promise<boolean> {
	return checkDepartmentPermission(userId, "contracts.admin");
}

export async function checkBoardRole(userId: string): Promise<boolean> {
	if (await checkAdminRole(userId)) {
		return true;
	}

	const { data, error } = await getSupabase()
		.from("members")
		.select("member_role, board_role, member_status, active")
		.eq("user_id", userId)
		.single();

	if (error) {
		if (isNotFoundError(error)) {
			return false;
		}
		throw error;
	}

	const member = data as {
		member_role?: string | null;
		board_role?: string | null;
		member_status?: string | null;
		active?: boolean | null;
	};
	const memberStatus =
		member.member_status ?? (member.active ? "active" : "inactive");

	return (
		memberStatus === "active" &&
		(member.board_role === "Board Member" ||
			member.member_role === "President" ||
			member.member_role === "Vice-President")
	);
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
