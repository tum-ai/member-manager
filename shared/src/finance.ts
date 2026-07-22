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
	created_at: DATE_TIME_SCHEMA,
	updated_at: DATE_TIME_SCHEMA,
});
export type FinanceProject = z.infer<typeof FinanceProjectSchema>;

export const FinanceProjectCreateSchema = z
	.object({
		parent_project_id: UUID_SCHEMA.nullable().optional(),
		name: z.string().trim().min(1).max(200),
		department: z.string().trim().min(1).max(120),
		period_type: FinancePeriodTypeSchema,
		period_key: z.string().trim().min(1),
		tax_area: FinanceTaxAreaSchema.nullable().optional(),
		target_amount: z.number().finite(),
		status: FinanceProjectStatusSchema.optional(),
		description: z.string().trim().max(2000).nullable().optional(),
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
