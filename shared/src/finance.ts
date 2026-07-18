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
	cost_location: z.string(),
	cost_location_two: z.string(),
	transaction_amount: z.number(),
	transaction_purpose: z.string(),
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

// Steuerlicher Bereich a cost location belongs to. The LnF team assigns this
// manually; the leading digit convention (10 ideell / 40 wirtschaftlich /
// 50 Zweckbetrieb) is not reliably derivable from BuchhaltungsButler data.
export const FINANCE_BEREICH_VALUES = [
	"ideell",
	"wirtschaftlich",
	"zweckbetrieb",
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
