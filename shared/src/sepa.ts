import { z } from "zod";
import { ibanSchema } from "./iban.js";

export const sepaSchema = z.object({
	iban: ibanSchema,
	bic: z.string().optional(),
	bank_name: z.string().trim().min(1, "Bank name is required"),
	mandate_agreed: z.boolean().refine((value) => value, {
		message: "You must agree to the SEPA mandate",
	}),
	privacy_agreed: z.boolean().refine((value) => value, {
		message: "You must agree to the Privacy Policy",
	}),
	data_privacy_notice_agreed: z.boolean().refine((value) => value, {
		message: "You must agree to the Data Privacy Notice",
	}),
	user_id: z.string(),
});

export const updateSepaSchema = sepaSchema.omit({
	user_id: true,
});

export type SepaSchemaInput = z.input<typeof sepaSchema>;
export type SepaSchema = z.infer<typeof sepaSchema>;
