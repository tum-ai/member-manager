import { z } from "zod";

function isValidDate(dateString: string): boolean {
	const regex = /^\d{4}-\d{2}-\d{2}$/;
	if (!regex.test(dateString)) return false;
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) return false;
	return date.toISOString().slice(0, 10) === dateString;
}

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
	batch: z.string().nullish(),
	department: z.string().nullish(),
	member_role: z.string().nullish(),
	degree: z.string().nullish(),
	school: z.string().nullish(),
	skills: z.array(z.string()).nullish(),
	profile_picture_url: z.string().nullish(),
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
		startDate: z
			.string()
			.min(1, "Start date is required")
			.refine(isValidDate, "Invalid start date"),
		endDate: z
			.string()
			.optional()
			.refine((val) => !val || isValidDate(val), "Invalid end date"),
		isStillActive: z.boolean(),
		weeklyHours: z.string().optional(),
		department: z.string().min(1, "Department is required"),
		isTeamLead: z.boolean(),
		tasksDescription: z
			.string()
			.min(1, "Tasks description is required")
			.max(1000, "Tasks description is too long (max 1000 characters)")
			.refine(
				(val) => val.trim().length > 0,
				"Tasks description cannot be empty",
			),
	})
	.refine(
		(data) => data.isStillActive || (data.endDate && data.endDate.length > 0),
		{
			message: "End date is required when not still active",
			path: ["endDate"],
		},
	)
	.refine(
		(data) => {
			if (data.isStillActive || !data.endDate) return true;
			return data.endDate >= data.startDate;
		},
		{
			message: "End date must be on or after start date",
			path: ["endDate"],
		},
	);

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
