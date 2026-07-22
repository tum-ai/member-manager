import {
	type FinancePeriodType,
	type FinanceReimbursementLink,
	resolveFinancePeriodRange,
} from "@member-manager/shared";
import { getBuchhaltungsButlerTransactions } from "./buchhaltungsbutlerPostings.js";
import { DatabaseError, ValidationError } from "./errors.js";
import { loadPostingAllocations } from "./financeAllocations.js";
import {
	buildEffectivePostingSplits,
	loadDepartmentMappings,
} from "./financeDepartments.js";
import { getSupabase } from "./supabase.js";

export interface ResolvedReimbursementFinanceLinks {
	finance_project_id: string | null;
	finance_plan_item_id: string | null;
	bb_posting_external_id: string | null;
}

interface FinanceLinkProject {
	id: string;
	department: string;
	period_type: FinancePeriodType;
	period_key: string;
}

interface FinanceLinkPlanItem {
	id: string;
	department: string;
	project_id: string | null;
	period_type: FinancePeriodType;
	period_key: string;
}

async function loadProject(projectId: string): Promise<FinanceLinkProject> {
	const { data, error } = await getSupabase()
		.from("finance_projects")
		.select("id, department, period_type, period_key")
		.eq("id", projectId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to validate reimbursement project");
	}
	if (!data) {
		throw new ValidationError("Finance project not found");
	}
	return data as FinanceLinkProject;
}

async function loadPlanItem(planItemId: string): Promise<FinanceLinkPlanItem> {
	const { data, error } = await getSupabase()
		.from("finance_plan_items")
		.select("id, department, project_id, period_type, period_key")
		.eq("id", planItemId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to validate reimbursement plan item");
	}
	if (!data) {
		throw new ValidationError("Finance plan item not found");
	}
	return data as FinanceLinkPlanItem;
}

function assertPostingInPeriod(
	postingDate: string,
	periodType: FinancePeriodType,
	periodKey: string,
	label: string,
): void {
	const range = resolveFinancePeriodRange(periodType, periodKey);
	if (postingDate < range.dateFrom || postingDate > range.dateTo) {
		throw new ValidationError(
			`BuchhaltungsButler posting must fall within the ${label} period`,
		);
	}
}

async function validatePostingExternalId(
	postingExternalId: string,
	department: string,
	project: FinanceLinkProject | null,
	planItem: FinanceLinkPlanItem | null,
): Promise<string> {
	const normalizedExternalId = postingExternalId.trim();
	const { transactions } = await getBuchhaltungsButlerTransactions({});
	const posting = transactions.find(
		(transaction) => transaction.external_id === normalizedExternalId,
	);
	if (!posting) {
		throw new ValidationError("BuchhaltungsButler posting not found");
	}
	const [mappings, allocations] = await Promise.all([
		loadDepartmentMappings(),
		loadPostingAllocations([normalizedExternalId]),
	]);
	const effectiveSplits = buildEffectivePostingSplits(
		[posting],
		mappings,
		allocations,
	);
	if (!effectiveSplits.some((split) => split.department === department)) {
		throw new ValidationError(
			"BuchhaltungsButler posting must belong to the reimbursement department",
		);
	}
	if (project) {
		assertPostingInPeriod(
			posting.date,
			project.period_type,
			project.period_key,
			"finance project",
		);
		if (
			!effectiveSplits.some(
				(split) =>
					split.department === department && split.projectId === project.id,
			)
		) {
			throw new ValidationError(
				"BuchhaltungsButler posting must be allocated to the selected finance project",
			);
		}
	}
	if (planItem) {
		assertPostingInPeriod(
			posting.date,
			planItem.period_type,
			planItem.period_key,
			"finance plan item",
		);
	}
	return normalizedExternalId;
}

export async function resolveReimbursementFinanceLinks(
	input: FinanceReimbursementLink,
	department: string,
): Promise<ResolvedReimbursementFinanceLinks> {
	const planItem = input.finance_plan_item_id
		? await loadPlanItem(input.finance_plan_item_id)
		: null;
	const resolvedProjectId =
		input.finance_project_id ?? planItem?.project_id ?? null;
	const project = resolvedProjectId
		? await loadProject(resolvedProjectId)
		: null;

	if (project && project.department !== department) {
		throw new ValidationError(
			"Finance project must belong to the reimbursement department",
		);
	}
	if (planItem && planItem.department !== department) {
		throw new ValidationError(
			"Finance plan item must belong to the reimbursement department",
		);
	}
	if (
		planItem?.project_id &&
		resolvedProjectId &&
		planItem.project_id !== resolvedProjectId
	) {
		throw new ValidationError(
			"Finance plan item must belong to the selected finance project",
		);
	}
	if (
		project &&
		planItem &&
		(project.period_type !== planItem.period_type ||
			project.period_key !== planItem.period_key)
	) {
		throw new ValidationError(
			"Finance plan item must belong to the selected finance project period",
		);
	}
	const postingExternalId = input.bb_posting_external_id
		? await validatePostingExternalId(
				input.bb_posting_external_id,
				department,
				project,
				planItem,
			)
		: null;

	return {
		finance_project_id: resolvedProjectId,
		finance_plan_item_id: input.finance_plan_item_id ?? null,
		bb_posting_external_id: postingExternalId,
	};
}
