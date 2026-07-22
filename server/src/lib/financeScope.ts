import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
} from "@member-manager/shared";
import {
	checkFinanceDepartmentMember,
	checkReimbursementReviewer,
	getActiveMemberDepartment,
} from "./auth.js";
import { ForbiddenError } from "./errors.js";
import {
	buildMappingLookup,
	resolveTransactionDepartment,
} from "./financeDepartments.js";

export interface FinanceScope {
	// null → unrestricted (all departments); a string → limited to that one.
	department: string | null;
}

// Resolve what a caller may see. A finance reviewer (LnF/admin) sees everything,
// or one department if they ask for it. A department-scoped member is forced to
// their own department and may never request another. Anyone else is forbidden.
export async function resolveFinanceViewerScope(
	userId: string,
	requestedDepartment?: string,
): Promise<FinanceScope> {
	if (await checkReimbursementReviewer(userId)) {
		return { department: requestedDepartment ?? null };
	}

	if (!(await checkFinanceDepartmentMember(userId))) {
		throw new ForbiddenError("Finance access required");
	}

	const department = await getActiveMemberDepartment(userId);
	if (!department) {
		throw new ForbiddenError("No department assigned");
	}

	if (requestedDepartment && requestedDepartment !== department) {
		throw new ForbiddenError("Cannot access another department's finances");
	}

	return { department };
}

// Assert the caller may write finance data for a specific department. A
// reviewer may write any department; a scoped member only their own. Throws
// ForbiddenError otherwise. Used for plan-item create/update/delete.
export async function assertCanWriteDepartment(
	userId: string,
	department: string,
): Promise<void> {
	if (await checkReimbursementReviewer(userId)) {
		return;
	}

	if (!(await checkFinanceDepartmentMember(userId))) {
		throw new ForbiddenError("Finance access required");
	}

	const own = await getActiveMemberDepartment(userId);
	if (!own || own !== department) {
		throw new ForbiddenError("Cannot modify another department's plan");
	}
}

// Restrict postings to their effective department. Saved allocation splits
// override stored cost-location mappings, which override the BB number fallback.
export function filterTransactionsByScope(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
	scope: FinanceScope,
): BuchhaltungsButlerTransaction[] {
	if (scope.department === null) {
		return transactions;
	}
	const lookup = buildMappingLookup(mappings);
	return transactions.filter(
		(transaction) =>
			resolveTransactionDepartment(transaction, lookup).department ===
			scope.department,
	);
}
