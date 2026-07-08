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
