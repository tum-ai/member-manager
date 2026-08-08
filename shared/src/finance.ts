import { z } from "zod";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const BuchhaltungsButlerTransactionSchema = z.object({
	external_id: z.string(),
	date: z.string().regex(ISO_DATE_PATTERN),
	postingtext: z.string(),
	amount: z.number(),
	currency: z.string(),
	vat: z.number(),
	credit_type: z.string(),
	debit_postingaccount_number: z.string(),
	credit_postingaccount_number: z.string(),
	booking_number: z.string().optional(),
	cost_location: z.string(),
	cost_location_two: z.string(),
	transaction_amount: z.number(),
	transaction_purpose: z.string(),
	receipts_assigned_invoice_numbers: z.string().optional(),
});

export const BuchhaltungsButlerTransactionsQuerySchema = z
	.object({
		date_from: z.string().regex(ISO_DATE_PATTERN).optional(),
		date_to: z.string().regex(ISO_DATE_PATTERN).optional(),
	})
	.superRefine((query, context) => {
		if (query.date_from && query.date_to && query.date_from > query.date_to) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "date_from must be before or equal to date_to",
				path: ["date_from"],
			});
		}
	});

export const BuchhaltungsButlerTransactionsResponseSchema = z.object({
	transactions: z.array(BuchhaltungsButlerTransactionSchema),
	source: z.enum(["mock", "real"]),
	generated_at: z.string().datetime(),
});

export type BuchhaltungsButlerTransaction = z.infer<
	typeof BuchhaltungsButlerTransactionSchema
>;
export type BuchhaltungsButlerTransactionsQuery = z.infer<
	typeof BuchhaltungsButlerTransactionsQuerySchema
>;
export type BuchhaltungsButlerTransactionsResponse = z.infer<
	typeof BuchhaltungsButlerTransactionsResponseSchema
>;

// --- Department mapping + analytics -----------------------------------------

// Canonical tax realm derived from the BuchhaltungsButler account suffix:
// 10 ideell, 40 wirtschaftlich, 50 gemischt.
export const FINANCE_BEREICH_VALUES = [
	"ideell",
	"wirtschaftlich",
	"gemischt",
] as const;
export const FinanceBereichSchema = z.enum(FINANCE_BEREICH_VALUES);
export type FinanceBereich = z.infer<typeof FinanceBereichSchema>;

// Sentinel department label for postings whose cost location has not (yet)
// been assigned by the LnF team. Kept in shared so client and server agree.
export const FINANCE_UNMAPPED_DEPARTMENT = "Nicht zugeordnet";

export const FinanceDepartmentMappingSchema = z.object({
	cost_location: z.string().min(1),
	department: z.string().min(1).nullable(),
	bereich: FinanceBereichSchema.nullable(),
	note: z.string().nullable(),
	// The sub-team the cost location's 2nd digit stands for (e.g. "Big
	// Makeathon"). Optional/legacy-nullable so older mappings still parse.
	sub_team: z.string().nullable().optional(),
});
export type FinanceDepartmentMapping = z.infer<
	typeof FinanceDepartmentMappingSchema
>;

// Upsert payload for the mapping editor. `cost_location` travels in the URL, so
// the body only carries the assignable attributes.
export const FinanceDepartmentMappingUpsertSchema = z.object({
	department: z.string().trim().min(1).nullable(),
	bereich: FinanceBereichSchema.nullable(),
	note: z.string().trim().max(500).nullable().optional(),
	sub_team: z.string().trim().max(120).nullable().optional(),
});
export type FinanceDepartmentMappingUpsert = z.infer<
	typeof FinanceDepartmentMappingUpsertSchema
>;

// A mapping row as shown in the editor: the stored assignment (if any) enriched
// with usage stats discovered from the live postings, so the LnF sees which
// cost locations still need assigning.
export const FinanceDepartmentMappingRowSchema = z.object({
	cost_location: z.string().min(1),
	department: z.string().min(1).nullable(),
	bereich: FinanceBereichSchema.nullable(),
	note: z.string().nullable(),
	sub_team: z.string().nullable().optional(),
	posting_count: z.number().int().nonnegative(),
	net: z.number(),
	sample_texts: z.array(z.string()),
});
export type FinanceDepartmentMappingRow = z.infer<
	typeof FinanceDepartmentMappingRowSchema
>;

export const FinanceDepartmentMappingsResponseSchema = z.object({
	rows: z.array(FinanceDepartmentMappingRowSchema),
	generated_at: z.string().datetime(),
});
export type FinanceDepartmentMappingsResponse = z.infer<
	typeof FinanceDepartmentMappingsResponseSchema
>;

// --- Category mapping (cost_location_two) -----------------------------------

// Sentinel bucket for postings whose second cost location (Kostenstelle 2) has
// no label assigned. In the BB data cost_location_two "0"/empty means the
// posting has no sub-category, so those also land here.
export const FINANCE_UNMAPPED_CATEGORY = "Ohne Kategorie";

export const FinanceCategoryMappingSchema = z.object({
	cost_location_two: z.string().min(1),
	label: z.string().min(1).nullable(),
	note: z.string().nullable(),
});
export type FinanceCategoryMapping = z.infer<
	typeof FinanceCategoryMappingSchema
>;

// Upsert payload for the category editor. `cost_location_two` travels in the
// URL, so the body only carries the assignable attributes.
export const FinanceCategoryMappingUpsertSchema = z.object({
	label: z.string().trim().min(1).nullable(),
	note: z.string().trim().max(500).nullable().optional(),
});
export type FinanceCategoryMappingUpsert = z.infer<
	typeof FinanceCategoryMappingUpsertSchema
>;

export const FinanceCategoryMappingRowSchema = z.object({
	cost_location_two: z.string().min(1),
	label: z.string().min(1).nullable(),
	note: z.string().nullable(),
	posting_count: z.number().int().nonnegative(),
	net: z.number(),
	sample_texts: z.array(z.string()),
});
export type FinanceCategoryMappingRow = z.infer<
	typeof FinanceCategoryMappingRowSchema
>;

export const FinanceCategoryMappingsResponseSchema = z.object({
	rows: z.array(FinanceCategoryMappingRowSchema),
	generated_at: z.string().datetime(),
});
export type FinanceCategoryMappingsResponse = z.infer<
	typeof FinanceCategoryMappingsResponseSchema
>;

export const FinanceCategorySummarySchema = z.object({
	category: z.string().min(1),
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
	count: z.number().int().nonnegative(),
	// True for the sentinel bucket of unlabelled second cost locations.
	unmapped: z.boolean(),
});
export type FinanceCategorySummary = z.infer<
	typeof FinanceCategorySummarySchema
>;

// --- Account labels (SKR03 ledger accounts) ---------------------------------

// Sentinel bucket for postings with no ledger account number at all (rare).
// Labelled and unlabelled accounts both keep their real number as the bucket
// key; the label is decoration, so no per-account "unmapped" flag is needed.
export const FINANCE_UNMAPPED_ACCOUNT = "Ohne Konto";

export const FinanceAccountLabelSchema = z.object({
	account: z.string().min(1),
	label: z.string().min(1).nullable(),
	note: z.string().nullable(),
});
export type FinanceAccountLabel = z.infer<typeof FinanceAccountLabelSchema>;

// Upsert payload for the account editor. `account` travels in the URL, so the
// body only carries the assignable attributes.
export const FinanceAccountLabelUpsertSchema = z.object({
	label: z.string().trim().min(1).nullable(),
	note: z.string().trim().max(500).nullable().optional(),
});
export type FinanceAccountLabelUpsert = z.infer<
	typeof FinanceAccountLabelUpsertSchema
>;

export const FinanceAccountLabelRowSchema = z.object({
	account: z.string().min(1),
	label: z.string().min(1).nullable(),
	note: z.string().nullable(),
	posting_count: z.number().int().nonnegative(),
	net: z.number(),
	sample_texts: z.array(z.string()),
});
export type FinanceAccountLabelRow = z.infer<
	typeof FinanceAccountLabelRowSchema
>;

export const FinanceAccountLabelsResponseSchema = z.object({
	rows: z.array(FinanceAccountLabelRowSchema),
	generated_at: z.string().datetime(),
});
export type FinanceAccountLabelsResponse = z.infer<
	typeof FinanceAccountLabelsResponseSchema
>;

export const FinanceAccountSummarySchema = z.object({
	account: z.string().min(1),
	label: z.string().min(1).nullable(),
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
	count: z.number().int().nonnegative(),
});
export type FinanceAccountSummary = z.infer<typeof FinanceAccountSummarySchema>;

export const FinanceDepartmentSummarySchema = z.object({
	department: z.string().min(1),
	bereich: FinanceBereichSchema.nullable(),
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
	count: z.number().int().nonnegative(),
	// True for the sentinel bucket of unassigned cost locations.
	unmapped: z.boolean(),
});
export type FinanceDepartmentSummary = z.infer<
	typeof FinanceDepartmentSummarySchema
>;

// VAT (Umsatzsteuer) breakdown of expenses by rate. BuchhaltungsButler reports
// `vat` as a percentage rate; the amount contained in a (gross) posting is
// derived as gross * rate / (100 + rate). Grouping by rate keeps each row an
// unambiguous gross/VAT/net triple an accountant can reconcile.
export const FinanceVatRateSummarySchema = z.object({
	rate: z.number().nonnegative(),
	// Gross expense magnitude booked at this rate (always >= 0).
	expenses: z.number(),
	// VAT contained in those gross expenses (always >= 0).
	vat: z.number(),
	count: z.number().int().nonnegative(),
});
export type FinanceVatRateSummary = z.infer<typeof FinanceVatRateSummarySchema>;

export const FinanceMonthlyPointSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/),
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
});
export type FinanceMonthlyPoint = z.infer<typeof FinanceMonthlyPointSchema>;

export const FinanceBereichSummarySchema = z.object({
	bereich: FinanceBereichSchema.nullable(),
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
	count: z.number().int().nonnegative(),
});
export type FinanceBereichSummary = z.infer<typeof FinanceBereichSummarySchema>;

// Analytics query: a date range plus an optional department scope. A finance
// reviewer may pass `department` to drill into one department; a department-
// scoped member is forced to their own department server-side regardless.
export const FinanceAnalyticsQuerySchema = z
	.object({
		date_from: z.string().regex(ISO_DATE_PATTERN).optional(),
		date_to: z.string().regex(ISO_DATE_PATTERN).optional(),
		department: z.string().min(1).optional(),
	})
	.superRefine((query, context) => {
		if (query.date_from && query.date_to && query.date_from > query.date_to) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "date_from must be before or equal to date_to",
				path: ["date_from"],
			});
		}
	});
export type FinanceAnalyticsQuery = z.infer<typeof FinanceAnalyticsQuerySchema>;

export const FinanceAnalyticsResponseSchema = z.object({
	by_department: z.array(FinanceDepartmentSummarySchema),
	by_category: z.array(FinanceCategorySummarySchema),
	by_account: z.array(FinanceAccountSummarySchema),
	by_month: z.array(FinanceMonthlyPointSchema),
	by_bereich: z.array(FinanceBereichSummarySchema),
	by_vat_rate: z.array(FinanceVatRateSummarySchema),
	totals: z.object({
		income: z.number(),
		expenses: z.number(),
		net: z.number(),
		// VAT contained in the gross expenses (always >= 0). Net expenses excl.
		// VAT are therefore `expenses - vat`.
		vat: z.number(),
		count: z.number().int().nonnegative(),
		unmapped_count: z.number().int().nonnegative(),
	}),
	source: z.enum(["mock", "real"]),
	generated_at: z.string().datetime(),
});
export type FinanceAnalyticsResponse = z.infer<
	typeof FinanceAnalyticsResponseSchema
>;

// --- Budgets (Phase 2) ------------------------------------------------------

// A budget is set per department per fiscal period. The period is configurable:
// either a calendar year ("2026") or a TUM.ai semester ("WS26" / "SS26").
export const FINANCE_PERIOD_TYPES = ["year", "semester"] as const;
export const FinancePeriodTypeSchema = z.enum(FINANCE_PERIOD_TYPES);
export type FinancePeriodType = z.infer<typeof FinancePeriodTypeSchema>;

const YEAR_KEY_PATTERN = /^\d{4}$/;
// Semester keys mirror member batches: WS/SS + two-digit year >= 20.
const SEMESTER_KEY_PATTERN = /^(WS|SS)(2\d|[3-9]\d)$/;

export function isValidFinancePeriodKey(
	type: FinancePeriodType,
	key: string,
): boolean {
	return type === "year"
		? YEAR_KEY_PATTERN.test(key)
		: SEMESTER_KEY_PATTERN.test(key);
}

// Map a fiscal period to the civil date range its postings fall in. Winter
// semester runs Oct–Mar (spanning the year boundary); summer semester Apr–Sep.
export function resolveFinancePeriodRange(
	type: FinancePeriodType,
	key: string,
): { dateFrom: string; dateTo: string } {
	if (type === "year") {
		return { dateFrom: `${key}-01-01`, dateTo: `${key}-12-31` };
	}
	const season = key.slice(0, 2);
	const year = 2000 + Number(key.slice(2));
	if (season === "WS") {
		return { dateFrom: `${year}-10-01`, dateTo: `${year + 1}-03-31` };
	}
	return { dateFrom: `${year}-04-01`, dateTo: `${year}-09-30` };
}

export const FinanceBudgetSchema = z.object({
	department: z.string().min(1),
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	amount_planned: z.number().nonnegative(),
	currency: z.string().min(1),
	note: z.string().nullable(),
});
export type FinanceBudget = z.infer<typeof FinanceBudgetSchema>;

// Upsert payload. Department + period identify the row; amount + note are the
// assignable attributes. The period key is validated against its type.
export const FinanceBudgetUpsertSchema = z
	.object({
		department: z.string().trim().min(1),
		period_type: FinancePeriodTypeSchema,
		period_key: z.string().trim().min(1),
		amount_planned: z.number().nonnegative(),
		note: z.string().trim().max(500).nullable().optional(),
	})
	.superRefine((value, context) => {
		if (!isValidFinancePeriodKey(value.period_type, value.period_key)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid period key for period type",
				path: ["period_key"],
			});
		}
	});
export type FinanceBudgetUpsert = z.infer<typeof FinanceBudgetUpsertSchema>;

export const FinanceBudgetQuerySchema = z
	.object({
		period_type: FinancePeriodTypeSchema,
		period_key: z.string().min(1),
		// Optional department scope; enforced server-side for scoped members.
		department: z.string().min(1).optional(),
	})
	.superRefine((value, context) => {
		if (!isValidFinancePeriodKey(value.period_type, value.period_key)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid period key for period type",
				path: ["period_key"],
			});
		}
	});
export type FinanceBudgetQuery = z.infer<typeof FinanceBudgetQuerySchema>;

// One department's budget vs. its actual (gross) expenses in the period. A
// department may have a budget but no spend yet (actual 0), or spend with no
// budget set (amount_planned null → remaining/pct null).
export const FinanceBudgetVsActualRowSchema = z.object({
	department: z.string().min(1),
	amount_planned: z.number().nullable(),
	actual_expenses: z.number(),
	remaining: z.number().nullable(),
	pct_used: z.number().nullable(),
	over_budget: z.boolean(),
	currency: z.string().min(1),
	note: z.string().nullable(),
});
export type FinanceBudgetVsActualRow = z.infer<
	typeof FinanceBudgetVsActualRowSchema
>;

export const FinanceBudgetVsActualResponseSchema = z.object({
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	rows: z.array(FinanceBudgetVsActualRowSchema),
	totals: z.object({
		amount_planned: z.number(),
		actual_expenses: z.number(),
		remaining: z.number(),
	}),
	source: z.enum(["mock", "real"]),
	generated_at: z.string().datetime(),
});
export type FinanceBudgetVsActualResponse = z.infer<
	typeof FinanceBudgetVsActualResponseSchema
>;

// --- Planning (Phase 4) -----------------------------------------------------

// Bottom-up plan line items a department drafts within its budget. `planned`
// is an intention, `committed` is contractually locked, `spent` is realised.
export const FINANCE_PLAN_STATUSES = ["planned", "committed", "spent"] as const;
export const FinancePlanStatusSchema = z.enum(FINANCE_PLAN_STATUSES);
export type FinancePlanStatus = z.infer<typeof FinancePlanStatusSchema>;

export const FINANCE_PLAN_DIRECTIONS = ["expense", "income"] as const;
export const FinancePlanDirectionSchema = z.enum(FINANCE_PLAN_DIRECTIONS);
export type FinancePlanDirection = z.infer<typeof FinancePlanDirectionSchema>;

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export const FinancePlanItemSchema = z.object({
	id: z.string().min(1),
	department: z.string().min(1),
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	label: z.string().min(1),
	category: z.string().nullable(),
	direction: FinancePlanDirectionSchema.optional(),
	planned_amount: z.number().nonnegative(),
	expected_month: z.string().regex(MONTH_PATTERN).nullable(),
	status: FinancePlanStatusSchema,
	note: z.string().nullable(),
	project_id: z.string().uuid().nullable().optional(),
	template_item_id: z.string().uuid().nullable().optional(),
	// A disabled Planposten stays visible in the T-view but is excluded from
	// every plan total and cannot receive new matches (FR-M3/FR-M8).
	//
	// Optional here and required on `FinanceManagedPlanItemSchema` below, the
	// same way `project_id`/`template_item_id` are handled: the base schema stays
	// tolerant of older payloads, the managed variant the T-account consumes is
	// exact.
	is_active: z.boolean().optional(),
	// Planned VAT rate as a percentage (19, 7, 0 …). Null = unknown, rendered as
	// "—" rather than 0 € so an unset rate is never mistaken for a zero-rated
	// item (FR-N5).
	vat_rate: z.number().min(0).max(100).nullable().optional(),
});
export type FinancePlanItem = z.infer<typeof FinancePlanItemSchema>;

export const FinancePlanItemCreateSchema = z
	.object({
		department: z.string().trim().min(1),
		period_type: FinancePeriodTypeSchema,
		period_key: z.string().trim().min(1),
		label: z.string().trim().min(1).max(200),
		category: z.string().trim().min(1).max(200).nullable().optional(),
		direction: FinancePlanDirectionSchema.optional(),
		planned_amount: z.number().nonnegative(),
		expected_month: z.string().regex(MONTH_PATTERN).nullable().optional(),
		status: FinancePlanStatusSchema.optional(),
		note: z.string().trim().max(500).nullable().optional(),
		// FR-M1: a Planposten is created on a node of the T-view, so it has to be
		// able to land inside a project or sub-project straight away. Until now
		// only template assignment could set this.
		project_id: z.string().uuid().nullable().optional(),
		is_active: z.boolean().optional(),
		vat_rate: z.number().min(0).max(100).nullable().optional(),
	})
	.superRefine((value, context) => {
		if (!isValidFinancePeriodKey(value.period_type, value.period_key)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid period key for period type",
				path: ["period_key"],
			});
		}
	});
export type FinancePlanItemCreate = z.infer<typeof FinancePlanItemCreateSchema>;

// Update leaves the item's department/period fixed; only the editable
// attributes travel in the body (the id is in the URL).
export const FinancePlanItemUpdateSchema = z.object({
	label: z.string().trim().min(1).max(200),
	category: z.string().trim().min(1).max(200).nullable().optional(),
	direction: FinancePlanDirectionSchema.optional(),
	planned_amount: z.number().nonnegative(),
	expected_month: z.string().regex(MONTH_PATTERN).nullable().optional(),
	status: FinancePlanStatusSchema,
	note: z.string().trim().max(500).nullable().optional(),
	// Moving a Planposten between projects is rejected server-side once postings
	// are matched to it — a match is only valid while the posting is allocated to
	// the item's project (FR-L7).
	project_id: z.string().uuid().nullable().optional(),
	is_active: z.boolean().optional(),
	vat_rate: z.number().min(0).max(100).nullable().optional(),
});
export type FinancePlanItemUpdate = z.infer<typeof FinancePlanItemUpdateSchema>;

export const FinancePlanQuerySchema = z
	.object({
		period_type: FinancePeriodTypeSchema,
		period_key: z.string().min(1),
		department: z.string().min(1).optional(),
	})
	.superRefine((value, context) => {
		if (!isValidFinancePeriodKey(value.period_type, value.period_key)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid period key for period type",
				path: ["period_key"],
			});
		}
	});
export type FinancePlanQuery = z.infer<typeof FinancePlanQuerySchema>;

export const FinancePlanItemsResponseSchema = z.object({
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	items: z.array(FinancePlanItemSchema),
	// Planned = Σ line items; budget = Σ ceilings; actual = Σ gross expenses —
	// all for the scope. The client warns when planned exceeds budget.
	totals: z.object({
		planned: z.number(),
		planned_expenses: z.number().optional(),
		planned_income: z.number().optional(),
		planned_net: z.number().optional(),
		budget: z.number(),
		actual: z.number(),
	}),
	source: z.enum(["mock", "real"]),
	generated_at: z.string().datetime(),
});
export type FinancePlanItemsResponse = z.infer<
	typeof FinancePlanItemsResponseSchema
>;

// --- Consolidated finance management ---------------------------------------

export const FinanceTaxAreaSchema = FinanceBereichSchema;
export type FinanceTaxArea = z.infer<typeof FinanceTaxAreaSchema>;

export const FINANCE_PROJECT_STATUSES = [
	"draft",
	"active",
	"completed",
	"cancelled",
] as const;
export const FinanceProjectStatusSchema = z.enum(FINANCE_PROJECT_STATUSES);
export type FinanceProjectStatus = z.infer<typeof FinanceProjectStatusSchema>;

const UUID_SCHEMA = z.string().uuid();
const DATE_TIME_SCHEMA = z.string().datetime({ offset: true });

export const FinanceProjectSchema = z.object({
	id: UUID_SCHEMA,
	parent_project_id: UUID_SCHEMA.nullable(),
	name: z.string().min(1),
	department: z.string().min(1),
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	tax_area: FinanceTaxAreaSchema.nullable(),
	target_amount: z.number(),
	status: FinanceProjectStatusSchema,
	description: z.string().nullable(),
	// The sub-team folder this project hangs under in the T-view (FR-L4). Set by
	// hand; independent of the sub-team a cost-location mapping assigns to
	// unallocated postings. Null = the project hangs directly off its department.
	sub_team: z.string().nullable(),
	created_at: DATE_TIME_SCHEMA,
	updated_at: DATE_TIME_SCHEMA,
});
export type FinanceProject = z.infer<typeof FinanceProjectSchema>;

// Split out as a plain object so the "create from selected invoices" variant
// (FR-L1) can extend it — a schema carrying `superRefine` effects cannot.
const FinanceProjectCreateFieldsSchema = z.object({
	parent_project_id: UUID_SCHEMA.nullable().optional(),
	name: z.string().trim().min(1).max(200),
	department: z.string().trim().min(1).max(120),
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().trim().min(1),
	tax_area: FinanceTaxAreaSchema.nullable().optional(),
	target_amount: z.number().finite(),
	status: FinanceProjectStatusSchema.optional(),
	description: z.string().trim().max(2000).nullable().optional(),
	sub_team: z.string().trim().min(1).max(120).nullable().optional(),
});

function validateProjectPeriodKey(
	value: { period_type: FinancePeriodType; period_key: string },
	context: z.RefinementCtx,
): void {
	if (!isValidFinancePeriodKey(value.period_type, value.period_key)) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Invalid period key for period type",
			path: ["period_key"],
		});
	}
}

export const FinanceProjectCreateSchema =
	FinanceProjectCreateFieldsSchema.superRefine(validateProjectPeriodKey);
export type FinanceProjectCreate = z.infer<typeof FinanceProjectCreateSchema>;

export const FinanceProjectUpdateSchema = z
	.object({
		parent_project_id: UUID_SCHEMA.nullable().optional(),
		name: z.string().trim().min(1).max(200).optional(),
		department: z.string().trim().min(1).max(120).optional(),
		period_type: FinancePeriodTypeSchema.optional(),
		period_key: z.string().trim().min(1).optional(),
		tax_area: FinanceTaxAreaSchema.nullable().optional(),
		target_amount: z.number().finite().optional(),
		status: FinanceProjectStatusSchema.optional(),
		description: z.string().trim().max(2000).nullable().optional(),
		sub_team: z.string().trim().min(1).max(120).nullable().optional(),
	})
	.refine(
		(value) => Object.values(value).some((entry) => entry !== undefined),
		{
			message: "At least one project field is required",
		},
	);
export type FinanceProjectUpdate = z.infer<typeof FinanceProjectUpdateSchema>;

export const FinanceProjectsQuerySchema = z
	.object({
		department: z.string().trim().min(1).optional(),
		period_type: FinancePeriodTypeSchema.optional(),
		period_key: z.string().trim().min(1).optional(),
		status: FinanceProjectStatusSchema.optional(),
	})
	.superRefine((value, context) => {
		if (Boolean(value.period_type) !== Boolean(value.period_key)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "period_type and period_key must be provided together",
				path: ["period_key"],
			});
			return;
		}
		if (
			value.period_type &&
			value.period_key &&
			!isValidFinancePeriodKey(value.period_type, value.period_key)
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid period key for period type",
				path: ["period_key"],
			});
		}
	});
export type FinanceProjectsQuery = z.infer<typeof FinanceProjectsQuerySchema>;

export const FinanceProjectsResponseSchema = z.object({
	projects: z.array(FinanceProjectSchema),
});
export type FinanceProjectsResponse = z.infer<
	typeof FinanceProjectsResponseSchema
>;

export const FinancePlanTemplateItemSchema = z.object({
	id: UUID_SCHEMA,
	template_id: UUID_SCHEMA,
	label: z.string().min(1),
	category: z.string().nullable(),
	direction: FinancePlanDirectionSchema.optional(),
	planned_amount: z.number().nonnegative(),
	expected_month: z.string().regex(MONTH_PATTERN).nullable(),
	note: z.string().nullable(),
	sort_order: z.number().int(),
});
export type FinancePlanTemplateItem = z.infer<
	typeof FinancePlanTemplateItemSchema
>;

export const FinancePlanTemplateSchema = z.object({
	id: UUID_SCHEMA,
	name: z.string().min(1),
	description: z.string().nullable(),
	tax_area: FinanceTaxAreaSchema.nullable(),
	is_active: z.boolean(),
	items: z.array(FinancePlanTemplateItemSchema),
	created_at: DATE_TIME_SCHEMA,
	updated_at: DATE_TIME_SCHEMA,
});
export type FinancePlanTemplate = z.infer<typeof FinancePlanTemplateSchema>;

export const FinancePlanTemplateCreateSchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000).nullable().optional(),
	tax_area: FinanceTaxAreaSchema.nullable().optional(),
	is_active: z.boolean().optional(),
});
export type FinancePlanTemplateCreate = z.infer<
	typeof FinancePlanTemplateCreateSchema
>;

export const FinancePlanTemplateUpdateSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().trim().max(2000).nullable().optional(),
		tax_area: FinanceTaxAreaSchema.nullable().optional(),
		is_active: z.boolean().optional(),
	})
	.refine(
		(value) => Object.values(value).some((entry) => entry !== undefined),
		{
			message: "At least one template field is required",
		},
	);
export type FinancePlanTemplateUpdate = z.infer<
	typeof FinancePlanTemplateUpdateSchema
>;

export const FinancePlanTemplateItemCreateSchema = z.object({
	label: z.string().trim().min(1).max(200),
	category: z.string().trim().min(1).max(200).nullable().optional(),
	direction: FinancePlanDirectionSchema.optional(),
	planned_amount: z.number().nonnegative(),
	expected_month: z.string().regex(MONTH_PATTERN).nullable().optional(),
	note: z.string().trim().max(500).nullable().optional(),
	sort_order: z.number().int().min(0).optional(),
});
export type FinancePlanTemplateItemCreate = z.infer<
	typeof FinancePlanTemplateItemCreateSchema
>;

export const FinancePlanTemplateItemUpdateSchema =
	FinancePlanTemplateItemCreateSchema.partial().refine(
		(value) => Object.values(value).some((entry) => entry !== undefined),
		{ message: "At least one template item field is required" },
	);
export type FinancePlanTemplateItemUpdate = z.infer<
	typeof FinancePlanTemplateItemUpdateSchema
>;

export const FinancePlanTemplatesResponseSchema = z.object({
	templates: z.array(FinancePlanTemplateSchema),
});
export type FinancePlanTemplatesResponse = z.infer<
	typeof FinancePlanTemplatesResponseSchema
>;

export const FinanceManagedPlanItemSchema = FinancePlanItemSchema.extend({
	project_id: UUID_SCHEMA.nullable(),
	template_item_id: UUID_SCHEMA.nullable(),
	is_active: z.boolean(),
	vat_rate: z.number().min(0).max(100).nullable(),
});
export type FinanceManagedPlanItem = z.infer<
	typeof FinanceManagedPlanItemSchema
>;

export const FinancePlanTemplateAssignmentCreateSchema = z.object({
	template_id: UUID_SCHEMA,
});
export type FinancePlanTemplateAssignmentCreate = z.infer<
	typeof FinancePlanTemplateAssignmentCreateSchema
>;

export const FinancePlanTemplateAssignmentResponseSchema = z.object({
	project_id: UUID_SCHEMA,
	template_id: UUID_SCHEMA,
	created_plan_items: z.array(FinanceManagedPlanItemSchema),
});
export type FinancePlanTemplateAssignmentResponse = z.infer<
	typeof FinancePlanTemplateAssignmentResponseSchema
>;

const FinanceAllocationTargetSchema = z.object({
	department: z.string().trim().min(1).max(120).nullable().optional(),
	project_id: UUID_SCHEMA.nullable().optional(),
	tax_area: FinanceTaxAreaSchema.nullable().optional(),
	note: z.string().trim().max(500).nullable().optional(),
});

function validateUniqueAllocationTargets(
	allocations: Array<{
		department?: string | null;
		project_id?: string | null;
		tax_area?: FinanceTaxArea | null;
	}>,
	context: z.RefinementCtx,
): void {
	const seenTargets = new Set<string>();
	for (const [index, allocation] of allocations.entries()) {
		const target = JSON.stringify([
			allocation.department ?? null,
			allocation.project_id ?? null,
			allocation.tax_area ?? null,
		]);
		if (seenTargets.has(target)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Allocation targets must be unique",
				path: ["allocations", index],
			});
		}
		seenTargets.add(target);
	}
}

export const FinancePostingAllocationInputSchema =
	FinanceAllocationTargetSchema.extend({
		amount: z.number().positive().optional(),
		percentage: z.number().positive().max(100).optional(),
	}).superRefine((value, context) => {
		if (!value.department && !value.project_id && !value.tax_area) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "An allocation target is required",
				path: ["department"],
			});
		}
		if (Boolean(value.amount) === Boolean(value.percentage)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Provide exactly one of amount or percentage",
				path: ["amount"],
			});
		}
	});
export type FinancePostingAllocationInput = z.infer<
	typeof FinancePostingAllocationInputSchema
>;

export const FinancePostingAllocationSchema = z.object({
	id: UUID_SCHEMA,
	posting_external_id: z.string().min(1),
	department: z.string().nullable(),
	project_id: UUID_SCHEMA.nullable(),
	tax_area: FinanceTaxAreaSchema.nullable(),
	allocated_amount: z.number(),
	allocated_percentage: z.number().positive().max(100),
	note: z.string().nullable(),
	created_by: z.string().nullable(),
	created_at: DATE_TIME_SCHEMA,
	updated_at: DATE_TIME_SCHEMA,
});
export type FinancePostingAllocation = z.infer<
	typeof FinancePostingAllocationSchema
>;

export const FinancePostingAllocationReplaceSchema = z
	.object({
		allocations: z.array(FinancePostingAllocationInputSchema).min(1).max(50),
	})
	.superRefine((value, context) => {
		validateUniqueAllocationTargets(value.allocations, context);
	});
export type FinancePostingAllocationReplace = z.infer<
	typeof FinancePostingAllocationReplaceSchema
>;

export const FinancePostingAllocationsResponseSchema = z.object({
	posting: BuchhaltungsButlerTransactionSchema,
	allocations: z.array(FinancePostingAllocationSchema),
});
export type FinancePostingAllocationsResponse = z.infer<
	typeof FinancePostingAllocationsResponseSchema
>;

// --- Bulk assignment of invoices to a project (FR-K5 / FR-L2) ---------------

// Assign many postings to one project in a single call. Deliberately narrower
// than the per-posting replace endpoint: it only writes a whole-posting (100 %)
// allocation, so a posting that is already split across several targets is
// refused rather than silently flattened (FR-L5).
export const FinancePostingAllocationBulkSchema = z.object({
	project_id: UUID_SCHEMA,
	posting_external_ids: z
		.array(z.string().trim().min(1).max(200))
		.min(1)
		.max(200),
	note: z.string().trim().max(500).nullable().optional(),
});
export type FinancePostingAllocationBulk = z.infer<
	typeof FinancePostingAllocationBulkSchema
>;

export const FINANCE_ALLOCATION_SKIP_REASONS = [
	// The posting already carries more than one allocation — use the split editor.
	"already_split",
	// The posting's booking date falls outside the project's period (FR-L8).
	"period_mismatch",
	// The posting is matched to a Planposten of another project (FR-L7).
	"matched_elsewhere",
	// The caller may not write the posting's department.
	"forbidden",
	"not_found",
] as const;
export const FinanceAllocationSkipReasonSchema = z.enum(
	FINANCE_ALLOCATION_SKIP_REASONS,
);
export type FinanceAllocationSkipReason = z.infer<
	typeof FinanceAllocationSkipReasonSchema
>;

// One entry per requested posting. A bulk assign is atomic *per posting*
// (FR-L6): the applied ones stay applied and every skip says exactly why.
export const FinanceAllocationResultSchema = z.object({
	posting_external_id: z.string().min(1),
	applied: z.boolean(),
	reason: FinanceAllocationSkipReasonSchema.nullable(),
});
export type FinanceAllocationResult = z.infer<
	typeof FinanceAllocationResultSchema
>;

export const FinancePostingAllocationBulkResponseSchema = z.object({
	project_id: UUID_SCHEMA,
	applied_count: z.number().int().nonnegative(),
	skipped_count: z.number().int().nonnegative(),
	results: z.array(FinanceAllocationResultSchema),
});
export type FinancePostingAllocationBulkResponse = z.infer<
	typeof FinancePostingAllocationBulkResponseSchema
>;

// FR-L1: create the project and allocate the selected invoices to it in one
// call, so a half-created project can never be left behind by a failed second
// request. The project is created regardless; per-posting skips are reported
// exactly as for a bulk assign.
export const FinanceProjectFromPostingsCreateSchema =
	FinanceProjectCreateFieldsSchema.extend({
		posting_external_ids: z
			.array(z.string().trim().min(1).max(200))
			.min(1)
			.max(200),
	}).superRefine(validateProjectPeriodKey);
export type FinanceProjectFromPostingsCreate = z.infer<
	typeof FinanceProjectFromPostingsCreateSchema
>;

export const FinanceProjectFromPostingsResponseSchema = z.object({
	project: FinanceProjectSchema,
	applied_count: z.number().int().nonnegative(),
	skipped_count: z.number().int().nonnegative(),
	results: z.array(FinanceAllocationResultSchema),
});
export type FinanceProjectFromPostingsResponse = z.infer<
	typeof FinanceProjectFromPostingsResponseSchema
>;

export const FINANCE_REALLOCATION_STATUSES = [
	"pending",
	"approved",
	"rejected",
] as const;
export const FinanceReallocationStatusSchema = z.enum(
	FINANCE_REALLOCATION_STATUSES,
);
export type FinanceReallocationStatus = z.infer<
	typeof FinanceReallocationStatusSchema
>;

export const FinanceReallocationRequestSchema = z.object({
	id: UUID_SCHEMA,
	posting_external_id: z.string().min(1),
	requesting_department: z.string().min(1),
	reason: z.string().min(1),
	status: FinanceReallocationStatusSchema,
	requested_by: z.string(),
	reviewed_by: z.string().nullable(),
	review_note: z.string().nullable(),
	reviewed_at: DATE_TIME_SCHEMA.nullable(),
	allocations: z.array(FinancePostingAllocationSchema),
	created_at: DATE_TIME_SCHEMA,
	updated_at: DATE_TIME_SCHEMA,
});
export type FinanceReallocationRequest = z.infer<
	typeof FinanceReallocationRequestSchema
>;

export const FinanceReallocationRequestCreateSchema = z
	.object({
		posting_external_id: z.string().trim().min(1).max(200),
		requesting_department: z.string().trim().min(1).max(120).optional(),
		reason: z.string().trim().min(1).max(2000),
		allocations: z.array(FinancePostingAllocationInputSchema).min(1).max(50),
	})
	.superRefine((value, context) => {
		validateUniqueAllocationTargets(value.allocations, context);
	});
export type FinanceReallocationRequestCreate = z.infer<
	typeof FinanceReallocationRequestCreateSchema
>;

export const FinanceReallocationRequestsQuerySchema = z.object({
	department: z.string().trim().min(1).optional(),
	status: FinanceReallocationStatusSchema.optional(),
});
export type FinanceReallocationRequestsQuery = z.infer<
	typeof FinanceReallocationRequestsQuerySchema
>;

export const FinanceReallocationReviewSchema = z.object({
	decision: z.enum(["approved", "rejected"]),
	review_note: z.string().trim().min(1).max(2000).nullable().optional(),
});
export type FinanceReallocationReview = z.infer<
	typeof FinanceReallocationReviewSchema
>;

export const FinanceReallocationRequestsResponseSchema = z.object({
	requests: z.array(FinanceReallocationRequestSchema),
});
export type FinanceReallocationRequestsResponse = z.infer<
	typeof FinanceReallocationRequestsResponseSchema
>;

export const FinanceBudgetTransferRequestSchema = z.object({
	id: UUID_SCHEMA,
	source_department: z.string().min(1),
	target_department: z.string().min(1),
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	amount: z.number().positive(),
	reason: z.string().min(1),
	status: FinanceReallocationStatusSchema,
	requested_by: z.string(),
	reviewed_by: z.string().nullable(),
	review_note: z.string().nullable(),
	reviewed_at: DATE_TIME_SCHEMA.nullable(),
	created_at: DATE_TIME_SCHEMA,
	updated_at: DATE_TIME_SCHEMA,
});
export type FinanceBudgetTransferRequest = z.infer<
	typeof FinanceBudgetTransferRequestSchema
>;

export const FinanceBudgetTransferRequestCreateSchema = z
	.object({
		source_department: z.string().trim().min(1).max(120).optional(),
		target_department: z.string().trim().min(1).max(120),
		period_type: FinancePeriodTypeSchema,
		period_key: z.string().trim().min(1),
		amount: z.number().positive(),
		reason: z.string().trim().min(1).max(2000),
	})
	.superRefine((value, context) => {
		if (!isValidFinancePeriodKey(value.period_type, value.period_key)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid period key for period type",
				path: ["period_key"],
			});
		}
		if (
			value.source_department &&
			value.source_department === value.target_department
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Source and target departments must differ",
				path: ["target_department"],
			});
		}
	});
export type FinanceBudgetTransferRequestCreate = z.infer<
	typeof FinanceBudgetTransferRequestCreateSchema
>;

export const FinanceBudgetTransferRequestsQuerySchema = z.object({
	department: z.string().trim().min(1).optional(),
	status: FinanceReallocationStatusSchema.optional(),
});
export type FinanceBudgetTransferRequestsQuery = z.infer<
	typeof FinanceBudgetTransferRequestsQuerySchema
>;

export const FinanceBudgetTransferRequestsResponseSchema = z.object({
	requests: z.array(FinanceBudgetTransferRequestSchema),
});
export type FinanceBudgetTransferRequestsResponse = z.infer<
	typeof FinanceBudgetTransferRequestsResponseSchema
>;

export const FINANCE_MATCH_TYPES = ["automatic", "manual"] as const;
export const FinanceMatchTypeSchema = z.enum(FINANCE_MATCH_TYPES);
export type FinanceMatchType = z.infer<typeof FinanceMatchTypeSchema>;

export const FinancePlanItemPostingMatchSchema = z.object({
	id: UUID_SCHEMA,
	plan_item_id: UUID_SCHEMA,
	posting_external_id: z.string().min(1),
	matched_amount: z.number().positive(),
	match_type: FinanceMatchTypeSchema,
	created_by: z.string().nullable(),
	created_at: DATE_TIME_SCHEMA,
});
export type FinancePlanItemPostingMatch = z.infer<
	typeof FinancePlanItemPostingMatchSchema
>;

export const FinancePlanItemPostingMatchCreateSchema = z.object({
	plan_item_id: UUID_SCHEMA,
	posting_external_id: z.string().trim().min(1).max(200),
	matched_amount: z.number().positive(),
	match_type: FinanceMatchTypeSchema.optional(),
});
export type FinancePlanItemPostingMatchCreate = z.infer<
	typeof FinancePlanItemPostingMatchCreateSchema
>;

export const FinanceReconciliationQuerySchema =
	FinancePlanQuerySchema.safeExtend({
		project_id: UUID_SCHEMA.optional(),
	});
export type FinanceReconciliationQuery = z.infer<
	typeof FinanceReconciliationQuerySchema
>;

export const FinanceReconciliationPostingSchema = z.object({
	posting: BuchhaltungsButlerTransactionSchema,
	scope_amount: z.number(),
	allocations: z.array(FinancePostingAllocationSchema),
	matches: z.array(FinancePlanItemPostingMatchSchema),
	matched_amount: z.number().nonnegative(),
	unmatched_amount: z.number().nonnegative(),
	overmatched_amount: z.number().nonnegative(),
});
export type FinanceReconciliationPosting = z.infer<
	typeof FinanceReconciliationPostingSchema
>;

export const FinanceReconciliationResponseSchema = z.object({
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	matches: z.array(FinancePlanItemPostingMatchSchema),
	unmatched_postings: z.array(FinanceReconciliationPostingSchema),
	unplanned_postings: z.array(FinanceReconciliationPostingSchema),
	source: z.enum(["mock", "real"]),
	generated_at: DATE_TIME_SCHEMA,
});
export type FinanceReconciliationResponse = z.infer<
	typeof FinanceReconciliationResponseSchema
>;

export const FinancePeriodReportQuerySchema = FinancePlanQuerySchema;
export type FinancePeriodReportQuery = z.infer<
	typeof FinancePeriodReportQuerySchema
>;

export const FinancePeriodReportAmountsSchema = z.object({
	budget: z.number().nonnegative(),
	plan: z.number().nonnegative(),
	planned_income: z.number().nonnegative().optional(),
	planned_net: z.number().optional(),
	actual: z.number().nonnegative(),
	remaining: z.number(),
	forecast: z.number().nonnegative(),
});
export type FinancePeriodReportAmounts = z.infer<
	typeof FinancePeriodReportAmountsSchema
>;

export const FinanceTaxAreaReportSchema = z.object({
	tax_area: FinanceTaxAreaSchema.nullable(),
	target_amount: z.number(),
	plan: z.number().nonnegative(),
	planned_income: z.number().nonnegative().optional(),
	planned_net: z.number().optional(),
	actual_income: z.number().nonnegative(),
	actual_expenses: z.number().nonnegative(),
	actual_net: z.number(),
	forecast_expenses: z.number().nonnegative(),
});
export type FinanceTaxAreaReport = z.infer<typeof FinanceTaxAreaReportSchema>;

export const FinanceDepartmentPeriodReportSchema =
	FinancePeriodReportAmountsSchema.extend({
		department: z.string().min(1),
		tax_area_totals: z.array(FinanceTaxAreaReportSchema),
	});
export type FinanceDepartmentPeriodReport = z.infer<
	typeof FinanceDepartmentPeriodReportSchema
>;

export const FinancePeriodReportResponseSchema = z.object({
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	departments: z.array(FinanceDepartmentPeriodReportSchema),
	totals: FinancePeriodReportAmountsSchema,
	tax_area_totals: z.array(FinanceTaxAreaReportSchema),
	source: z.enum(["mock", "real"]),
	generated_at: DATE_TIME_SCHEMA,
});
export type FinancePeriodReportResponse = z.infer<
	typeof FinancePeriodReportResponseSchema
>;

export const FinanceReimbursementLinkSchema = z.object({
	finance_project_id: UUID_SCHEMA.nullable().optional(),
	finance_plan_item_id: UUID_SCHEMA.nullable().optional(),
	bb_posting_external_id: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.refine(
			(value) =>
				![...value].some((character) => {
					const code = character.charCodeAt(0);
					return code < 32 || code === 127;
				}),
			"BB posting external id cannot contain control characters",
		)
		.nullable()
		.optional(),
});
export type FinanceReimbursementLink = z.infer<
	typeof FinanceReimbursementLinkSchema
>;

// --- T-account (T-Konto) per department -------------------------------------

// A single-department "T-account" view: expenses on the left, income on the
// right, actual (booked BB postings) and planned (plan items) side by side,
// grouped by project so a Makeathon/Hackathon shows as one expandable folder
// with its own net profit. Query reuses the plan query (period + department);
// the department is required server-side (the view is always for one department).
export const FinanceTAccountQuerySchema = FinancePlanQuerySchema;
export type FinanceTAccountQuery = z.infer<typeof FinanceTAccountQuerySchema>;

// The expanded detail of a booked posting (FR-K2). Carried inline on the actual
// line so opening a row costs no extra round-trip (FR-K3) — the server already
// holds the postings in memory while it builds the response.
export const FinanceTAccountPostingDetailSchema = z.object({
	booking_date: z.string().regex(ISO_DATE_PATTERN),
	// BB's `receipts_assigned_invoice_numbers`; absent on postings without a
	// receipt (bank fees, corrections).
	invoice_number: z.string().nullable(),
	counterparty: z.string().nullable(),
	purpose: z.string().nullable(),
	currency: z.string().min(1),
	// The posting's own gross amount, signed as BB reports it. `amount` on the
	// line is this posting's share of the department after allocation splits, so
	// the two differ on a split posting — showing both is the point of the panel.
	posting_amount: z.number(),
	debit_account: z.string().nullable(),
	credit_account: z.string().nullable(),
	account_label: z.string().nullable(),
	cost_location: z.string().nullable(),
	sub_team: z.string().nullable(),
	allocations: z.array(FinancePostingAllocationSchema),
	matches: z.array(FinancePlanItemPostingMatchSchema),
});
export type FinanceTAccountPostingDetail = z.infer<
	typeof FinanceTAccountPostingDetailSchema
>;

// The expanded detail of a Planposten (FR-K4) plus the Plan/Ist/Delta readout
// that backs "Plan auf Ist korrigieren" (FR-M6).
export const FinanceTAccountPlanDetailSchema = z.object({
	expected_month: z.string().nullable(),
	note: z.string().nullable(),
	planned_amount: z.number().nonnegative(),
	// Σ of the matches against this Planposten — the realised "Ist".
	matched_amount: z.number().nonnegative(),
	// matched_amount − planned_amount: positive = overspent, negative = open.
	delta: z.number(),
	is_active: z.boolean(),
	vat_rate: z.number().min(0).max(100).nullable(),
	matches: z.array(FinancePlanItemPostingMatchSchema),
});
export type FinanceTAccountPlanDetail = z.infer<
	typeof FinanceTAccountPlanDetailSchema
>;

// One row in a T-account column. `amount` is a positive magnitude — the column
// (expense/income) carries the sign meaning. `vat_amount` is the VAT embedded in
// that gross amount (income or expense), null when the rate is unknown/zero.
export const FinanceTAccountLineSchema = z.object({
	kind: z.enum(["actual", "plan"]),
	direction: FinancePlanDirectionSchema,
	label: z.string().min(1),
	category: z.string().nullable(),
	project_id: UUID_SCHEMA.nullable(),
	amount: z.number().nonnegative(),
	vat_amount: z.number().nonnegative().nullable(),
	// The rate behind `vat_amount`, so the UI can label it and drive the
	// Netto/Brutto toggle without re-deriving it (FR-N1). Null = unknown.
	vat_rate: z.number().min(0).max(100).nullable(),
	// `amount` net of `vat_amount`. Precomputed so gross and net never disagree
	// between client and server (FR-N4/FR-N6).
	net_amount: z.number().nonnegative(),
	// Plan lines carry their status (planned/committed/spent); actual lines null.
	status: FinancePlanStatusSchema.nullable(),
	posting_external_id: z.string().nullable(),
	plan_item_id: z.string().nullable(),
	// Exactly one of these is set, matching `kind`.
	posting_detail: FinanceTAccountPostingDetailSchema.nullable(),
	plan_detail: FinanceTAccountPlanDetailSchema.nullable(),
});
export type FinanceTAccountLine = z.infer<typeof FinanceTAccountLineSchema>;

// VAT for one column of one node (FR-N3). Named by direction because the two
// sides are legally different things: Vorsteuer is reclaimable input tax on
// expenses, Umsatzsteuer is output tax owed on income.
export const FinanceTAccountVatSchema = z.object({
	// Σ VAT embedded in the booked lines of this column.
	actual: z.number().nonnegative(),
	// Σ VAT expected from the still-open planned lines of this column.
	plan: z.number().nonnegative(),
});
export type FinanceTAccountVat = z.infer<typeof FinanceTAccountVatSchema>;

// Income − expenses for one scope. `saldo` is the profit (positive) or deficit.
export const FinanceTAccountSaldoSchema = z.object({
	income: z.number(),
	expenses: z.number(),
	saldo: z.number(),
});
export type FinanceTAccountSaldo = z.infer<typeof FinanceTAccountSaldoSchema>;

// A group of lines: either the ungrouped department bucket (`project_id` null)
// or one project. `actual` is booked-only; `plan` is actual + planned combined.
export const FinanceTAccountGroupSchema = z.object({
	project_id: UUID_SCHEMA.nullable(),
	project_name: z.string().nullable(),
	parent_project_id: UUID_SCHEMA.nullable(),
	// The sub-team folder this group hangs under. For a sub-team group itself it
	// repeats its own name; for a project it is the project's `sub_team` (FR-L4).
	// Null = hangs directly off the department.
	sub_team: z.string().nullable(),
	// True for the synthetic folder that represents a sub-team rather than a
	// project, so the client can tell "Big Makeathon (sub-team)" apart from a
	// project that happens to have no id yet.
	is_sub_team: z.boolean(),
	// The project's target balance (Zielsaldo), null for the ungrouped bucket and
	// for projects without a target. Drives the deviation-vs-target readout.
	target_amount: z.number().nullable(),
	expense_lines: z.array(FinanceTAccountLineSchema),
	income_lines: z.array(FinanceTAccountLineSchema),
	actual: FinanceTAccountSaldoSchema,
	plan: FinanceTAccountSaldoSchema,
	// Vorsteuer (expense column) and Umsatzsteuer (income column) for this group
	// alone — children are not rolled in, matching `actual`/`plan` (FR-N3).
	vorsteuer: FinanceTAccountVatSchema,
	umsatzsteuer: FinanceTAccountVatSchema,
});
export type FinanceTAccountGroup = z.infer<typeof FinanceTAccountGroupSchema>;

export const FinanceTAccountResponseSchema = z.object({
	period_type: FinancePeriodTypeSchema,
	period_key: z.string().min(1),
	department: z.string().min(1),
	// Ungrouped bucket first (project_id null), then one group per project.
	groups: z.array(FinanceTAccountGroupSchema),
	totals: z.object({
		actual: FinanceTAccountSaldoSchema,
		plan: FinanceTAccountSaldoSchema,
		// VAT embedded in the gross income / expense magnitudes (always >= 0).
		vat_income: z.number().nonnegative(),
		vat_expenses: z.number().nonnegative(),
		// Umsatzsteuer owed minus Vorsteuer reclaimable = what the department
		// actually owes the tax office. Signed: negative means a refund (FR-N3).
		vat_payload: z.number(),
	}),
	source: z.enum(["mock", "real"]),
	generated_at: DATE_TIME_SCHEMA,
});
export type FinanceTAccountResponse = z.infer<
	typeof FinanceTAccountResponseSchema
>;
