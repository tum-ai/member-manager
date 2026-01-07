import { z } from "zod";

export const memberSchema = z.object({
	active: z.boolean(),
	salutation: z.string().min(1, "Salutation is required"),
	title: z.string().optional(),
	surname: z.string().min(1, "Surname is required"),
	given_name: z.string().min(1, "Given Name is required"),
	email: z.string().email("Invalid email"),
	date_of_birth: z.string().min(1, "Date of birth is required"),
	street: z.string().min(1, "Street is required"),
	number: z.string().min(1, "Number is required"),
	postal_code: z.string().min(1, "Postal Code is required"),
	city: z.string().min(1, "City is required"),
	country: z.string().min(1, "Country is required"),
	user_id: z.string(),
});

export const sepaSchema = z.object({
	iban: z.string().min(15, "Invalid IBAN"), // Basic length check
	bic: z.string().optional(),
	bank_name: z.string().min(1, "Bank name is required"),
	mandate_agreed: z.boolean(),
	privacy_agreed: z.boolean(),
	user_id: z.string(),
});

export type MemberSchema = z.infer<typeof memberSchema>;
export type SepaSchema = z.infer<typeof sepaSchema>;
