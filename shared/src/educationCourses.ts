import { z } from "zod";

export const EDUCATIONAL_COURSE_TIME_ZONE = "Europe/Berlin";

export function getEducationalCourseDateOnly(value = new Date()): string {
	const dateParts = new Intl.DateTimeFormat("en-US", {
		timeZone: EDUCATIONAL_COURSE_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(value);
	const part = (type: "year" | "month" | "day") =>
		dateParts.find((datePart) => datePart.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
}

export const EDUCATIONAL_COURSE_ROLES = [
	"participant",
	"administrator",
] as const;
export const educationalCourseRoleSchema = z.enum(EDUCATIONAL_COURSE_ROLES);
export type EducationalCourseRole = z.infer<typeof educationalCourseRoleSchema>;

export const EDUCATIONAL_COURSE_APPLICATION_STATUSES = [
	"pending",
	"approved",
	"rejected",
] as const;
export const educationalCourseApplicationStatusSchema = z.enum(
	EDUCATIONAL_COURSE_APPLICATION_STATUSES,
);
export type EducationalCourseApplicationStatus = z.infer<
	typeof educationalCourseApplicationStatusSchema
>;

export const createEducationalCoursePeriodSchema = z
	.object({
		startsOn: z.iso.date(),
		endsOn: z.iso.date(),
		capacity: z.number().int().positive().max(10_000),
	})
	.strict()
	.refine((period) => period.endsOn >= period.startsOn, {
		message: "End date must be on or after the start date.",
		path: ["endsOn"],
	});
export type CreateEducationalCoursePeriodInput = z.infer<
	typeof createEducationalCoursePeriodSchema
>;

export const updateEducationalCoursePeriodSchema = z
	.object({
		applicationsOpen: z.boolean(),
	})
	.strict();
export type UpdateEducationalCoursePeriodInput = z.infer<
	typeof updateEducationalCoursePeriodSchema
>;

export const reviewEducationalCourseApplicationSchema = z
	.object({
		decision: z.enum(["approved", "rejected"]),
	})
	.strict();
export type ReviewEducationalCourseApplicationInput = z.infer<
	typeof reviewEducationalCourseApplicationSchema
>;

export const educationalCourseParticipantSchema = z.object({
	userId: z.string().guid(),
	givenName: z.string(),
	surname: z.string(),
	active: z.boolean(),
});
export type EducationalCourseParticipant = z.infer<
	typeof educationalCourseParticipantSchema
>;

export const educationalCourseParticipantCandidateSchema = z.object({
	userId: z.string().guid(),
	givenName: z.string(),
	surname: z.string(),
	email: z.string(),
});
export type EducationalCourseParticipantCandidate = z.infer<
	typeof educationalCourseParticipantCandidateSchema
>;

export const searchEducationalCourseParticipantCandidatesSchema = z
	.object({
		search: z.string().trim().min(2).max(100),
	})
	.strict();
export type SearchEducationalCourseParticipantCandidatesInput = z.infer<
	typeof searchEducationalCourseParticipantCandidatesSchema
>;

export const approvedEducationalCourseParticipantSchema = z.object({
	userId: z.string().guid(),
	displayName: z.string(),
});
export type ApprovedEducationalCourseParticipant = z.infer<
	typeof approvedEducationalCourseParticipantSchema
>;

export const educationalCourseApplicationSchema = z.object({
	id: z.string().uuid(),
	periodId: z.string().uuid(),
	userId: z.string().guid(),
	givenName: z.string(),
	surname: z.string(),
	status: educationalCourseApplicationStatusSchema,
	reviewedAt: z.iso.datetime({ offset: true }).nullable(),
	createdAt: z.iso.datetime({ offset: true }),
	updatedAt: z.iso.datetime({ offset: true }),
});
export type EducationalCourseApplication = z.infer<
	typeof educationalCourseApplicationSchema
>;

export const educationalCoursePeriodSchema = z.object({
	id: z.string().uuid(),
	startsOn: z.iso.date(),
	endsOn: z.iso.date(),
	capacity: z.number().int().positive(),
	applicationsOpen: z.boolean(),
	approvedParticipants: z.array(approvedEducationalCourseParticipantSchema),
	myApplication: educationalCourseApplicationSchema.nullable(),
	createdAt: z.iso.datetime({ offset: true }),
	updatedAt: z.iso.datetime({ offset: true }),
});
export type EducationalCoursePeriod = z.infer<
	typeof educationalCoursePeriodSchema
>;

export const educationalCoursePeriodDetailSchema = z.object({
	period: educationalCoursePeriodSchema,
	applications: z.array(educationalCourseApplicationSchema),
});
export type EducationalCoursePeriodDetail = z.infer<
	typeof educationalCoursePeriodDetailSchema
>;

export const educationalCourseAccessSchema = z.object({
	educationalCourseRole: educationalCourseRoleSchema.nullable(),
});
export type EducationalCourseAccess = z.infer<
	typeof educationalCourseAccessSchema
>;

export const educationalCoursePeriodListSchema = z.object({
	periods: z.array(educationalCoursePeriodSchema),
});
export type EducationalCoursePeriodList = z.infer<
	typeof educationalCoursePeriodListSchema
>;

export const educationalCourseParticipantListSchema = z.object({
	participants: z.array(educationalCourseParticipantSchema),
});
export type EducationalCourseParticipantList = z.infer<
	typeof educationalCourseParticipantListSchema
>;

export const educationalCourseParticipantCandidateListSchema = z.object({
	candidates: z.array(educationalCourseParticipantCandidateSchema),
});
export type EducationalCourseParticipantCandidateList = z.infer<
	typeof educationalCourseParticipantCandidateListSchema
>;
