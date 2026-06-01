import {
	type DepartmentPermissionMap,
	isPermission,
	type Permission,
} from "@member-manager/shared";
import { getSupabase } from "./supabase.js";

interface DepartmentPermissionRow {
	department: string;
	permissions: unknown;
}

// The DB column is free-form jsonb; drop anything that isn't a known permission
// so a stale or hand-edited row can never widen access.
function sanitizePermissions(value: unknown): Permission[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const granted: Permission[] = [];
	for (const entry of value) {
		if (isPermission(entry) && !granted.includes(entry)) {
			granted.push(entry);
		}
	}
	return granted;
}

export async function fetchDepartmentPermissions(
	department: string | null | undefined,
): Promise<Permission[]> {
	if (!department) {
		return [];
	}

	const { data, error } = await getSupabase()
		.from("department_permissions")
		.select("permissions")
		.eq("department", department)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return sanitizePermissions(
		(data as { permissions?: unknown } | null)?.permissions,
	);
}

export async function fetchDepartmentPermissionMap(): Promise<DepartmentPermissionMap> {
	const { data, error } = await getSupabase()
		.from("department_permissions")
		.select("department, permissions");

	if (error) {
		throw error;
	}

	const map: DepartmentPermissionMap = {};
	for (const row of (data ?? []) as DepartmentPermissionRow[]) {
		map[row.department] = sanitizePermissions(row.permissions);
	}
	return map;
}

export async function setDepartmentPermissions(
	assignments: DepartmentPermissionMap,
	updatedBy: string,
): Promise<DepartmentPermissionMap> {
	const rows = Object.entries(assignments).map(([department, permissions]) => ({
		department,
		permissions: sanitizePermissions(permissions),
		updated_at: new Date().toISOString(),
		updated_by: updatedBy,
	}));

	if (rows.length > 0) {
		const { error } = await getSupabase()
			.from("department_permissions")
			.upsert(rows, { onConflict: "department" });

		if (error) {
			throw error;
		}
	}

	return fetchDepartmentPermissionMap();
}
