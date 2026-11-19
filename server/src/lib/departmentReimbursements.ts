import type {
	DepartmentReimbursementRequest,
	DepartmentReimbursementsResponse,
} from "@member-manager/shared";
import { getActiveMemberDepartment } from "./auth.js";
import { DatabaseError } from "./errors.js";
import { getSupabase } from "./supabase.js";

// The only columns read for this view. Receipts, payment details and the
// rejection reason belong to the requester and Legal & Finance, so they are
// never loaded here.
const DEPARTMENT_REQUEST_COLUMNS =
	"id, user_id, amount, date, description, submission_type, status, approval_status, first_approved_at, payment_status, created_at";

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadRequesterNames(
	userIds: string[],
): Promise<Map<string, string>> {
	if (userIds.length === 0) {
		return new Map();
	}

	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname")
		.in("user_id", userIds);
	if (error) {
		throw new DatabaseError("Failed to load reimbursement requesters");
	}

	const names = new Map<string, string>();
	for (const member of (data ?? []) as Row[]) {
		const name = [text(member.given_name), text(member.surname)]
			.filter(Boolean)
			.join(" ");
		if (name) {
			names.set(String(member.user_id), name);
		}
	}
	return names;
}

/**
 * Lists the requests filed for the caller's department, newest first, so its
 * members can see what was already submitted (#367).
 *
 * The scope is the caller's own department, taken from their member row. That
 * department is admin-controlled, so the caller can't widen it, and a member
 * who is inactive or has no department gets an empty list.
 */
export async function listDepartmentReimbursements(
	userId: string,
): Promise<DepartmentReimbursementsResponse> {
	const department = await getActiveMemberDepartment(userId);
	if (!department) {
		return { department: null, requests: [] };
	}

	const { data, error } = await getSupabase()
		.from("reimbursements")
		.select(DEPARTMENT_REQUEST_COLUMNS)
		.eq("department", department)
		.order("created_at", { ascending: false });
	if (error) {
		throw new DatabaseError("Failed to load department reimbursements");
	}

	const rows = (data ?? []) as Row[];
	const requesterNames = await loadRequesterNames([
		...new Set(rows.map((row) => String(row.user_id))),
	]);

	// Built field by field, so a column added to the table later can't leak
	// into this response.
	const requests = rows.map(
		(row): DepartmentReimbursementRequest => ({
			id: String(row.id),
			requester_name: requesterNames.get(String(row.user_id)) ?? null,
			is_own: row.user_id === userId,
			amount: Number(row.amount) || 0,
			date: String(row.date ?? ""),
			description: String(row.description ?? ""),
			submission_type:
				row.submission_type as DepartmentReimbursementRequest["submission_type"],
			status: row.status as DepartmentReimbursementRequest["status"],
			approval_status:
				row.approval_status as DepartmentReimbursementRequest["approval_status"],
			first_approved_at: text(row.first_approved_at),
			payment_status:
				row.payment_status as DepartmentReimbursementRequest["payment_status"],
			created_at: String(row.created_at ?? ""),
		}),
	);

	return { department, requests };
}
