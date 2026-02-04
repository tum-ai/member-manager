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
	iban: z.string().min(15, "Invalid IBAN"),
	bic: z.string().optional(),
	bank_name: z.string().min(1, "Bank name is required"),
	mandate_agreed: z.boolean(),
	privacy_agreed: z.boolean(),
	user_id: z.string(),
});

export const engagementSchema = z
	.object({
		id: z.string(),
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().optional(),
		isStillActive: z.boolean(),
		weeklyHours: z.string().min(1, "Weekly hours is required"),
		department: z.string().min(1, "Department is required"),
		isTeamLead: z.boolean(),
		tasksDescription: z
			.string()
			.min(1, "Tasks description is required")
			.refine(
				(val) => val.trim().length > 0,
				"Tasks description cannot be empty",
			),
	})
	.refine((data) => data.isStillActive || data.endDate, {
		message: "End date is required when not still active",
		path: ["endDate"],
	});

export const engagementFormSchema = z.object({
	engagements: z
		.array(engagementSchema)
		.min(1, "At least one engagement is required")
		.max(5, "Maximum 5 engagements allowed"),
});

export type MemberSchema = z.infer<typeof memberSchema>;
export type SepaSchema = z.infer<typeof sepaSchema>;
export type EngagementSchema = z.infer<typeof engagementSchema>;
export type EngagementFormSchema = z.infer<typeof engagementFormSchema>;
