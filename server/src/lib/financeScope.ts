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
	normalizeCostLocation,
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

// Restrict postings to those whose cost location maps to the scope department.
// An unrestricted scope (department null) passes everything through.
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
			lookup.get(normalizeCostLocation(transaction.cost_location))
				?.department === scope.department,
	);
}
