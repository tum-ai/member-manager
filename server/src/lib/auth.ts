import { isNotFoundError } from "./errors.js";
import { supabase } from "./supabase.js";

export async function checkAdminRole(userId: string): Promise<boolean> {
	const { data: roleData, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", userId)
		.single();

	if (roleError && !isNotFoundError(roleError)) {
		throw roleError;
	}

	return roleData?.role === "admin";
}
