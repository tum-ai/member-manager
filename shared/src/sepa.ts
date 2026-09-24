import { z } from "zod";
import { INVALID_IBAN_MESSAGE, ibanSchema, normalizeIban } from "./iban.js";

/** Every agreement required whenever bank details are saved. */
const SEPA_AGREEMENT_MESSAGES = {
	mandate_agreed: "You must agree to the SEPA mandate",
	privacy_agreed: "You must agree to the Privacy Policy",
	data_privacy_notice_agreed: "You must agree to the Data Privacy Notice",
} as const;

export const sepaSchema = z.object({
	iban: ibanSchema,
	bic: z.string().optional(),
	bank_name: z.string().trim().min(1, "Bank name is required"),
	mandate_agreed: z.boolean().refine((value) => value, {
		message: SEPA_AGREEMENT_MESSAGES.mandate_agreed,
	}),
	privacy_agreed: z.boolean().refine((value) => value, {
		message: SEPA_AGREEMENT_MESSAGES.privacy_agreed,
	}),
	data_privacy_notice_agreed: z.boolean().refine((value) => value, {
		message: SEPA_AGREEMENT_MESSAGES.data_privacy_notice_agreed,
	}),
	user_id: z.string(),
});

export type SepaSchemaInput = z.input<typeof sepaSchema>;
export type SepaSchema = z.infer<typeof sepaSchema>;

export const BANK_DETAILS_REMOVAL_MESSAGE =
	"Bank details can't be removed once saved — edit them instead";

type BankDetailsFields = {
	iban?: string | null;
	bic?: string | null;
	bank_name?: string | null;
};

/**
 * True when any bank field (IBAN, BIC, bank name) holds a non-blank value.
 * Works on form input as well as on stored rows, where the values are
 * `enc-v1:` ciphertext — presence is all that is checked, never content.
 */
export function hasBankDetailsInput(value: BankDetailsFields): boolean {
	return [value.iban, value.bic, value.bank_name].some(
		(field) => typeof field === "string" && field.trim() !== "",
	);
}

/**
 * Profile-page SEPA contract (`PUT /api/sepa/:userId`).
 *
 * Bank details are optional as a group: all of IBAN, BIC and bank name may be
 * blank, in which case only the agreements are saved, whatever their values.
 * As soon as any bank field is filled, the group is validated like
 * `sepaSchema`: a valid IBAN, a bank name and all three agreements (SEPA
 * mandate, Privacy Policy, Data Privacy Notice) are required.
 *
 * Whether existing bank details may be cleared depends on stored state, so
 * that rule is enforced by the caller (see `BANK_DETAILS_REMOVAL_MESSAGE`).
 */
export const profileSepaSchema = z
	.object({
		iban: z.string(),
		bic: z.string().optional(),
		bank_name: z.string(),
		mandate_agreed: z.boolean(),
		privacy_agreed: z.boolean(),
		data_privacy_notice_agreed: z.boolean(),
	})
	.superRefine((value, ctx) => {
		if (!hasBankDetailsInput(value)) {
			return;
		}
		if (!ibanSchema.safeParse(value.iban).success) {
			ctx.addIssue({
				code: "custom",
				path: ["iban"],
				message: INVALID_IBAN_MESSAGE,
			});
		}
		if (value.bank_name.trim() === "") {
			ctx.addIssue({
				code: "custom",
				path: ["bank_name"],
				message: "Bank name is required",
			});
		}
		for (const [field, message] of Object.entries(SEPA_AGREEMENT_MESSAGES)) {
			if (!value[field as keyof typeof SEPA_AGREEMENT_MESSAGES]) {
				ctx.addIssue({ code: "custom", path: [field], message });
			}
		}
	})
	.transform((value) => ({
		...value,
		iban: normalizeIban(value.iban),
		bic: value.bic?.trim() ?? "",
		bank_name: value.bank_name.trim(),
	}));

export type ProfileSepaInput = z.input<typeof profileSepaSchema>;
export type ProfileSepa = z.output<typeof profileSepaSchema>;
