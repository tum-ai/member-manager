import { z } from "zod";

/** Claim kinds persisted by Beacon's Layer-A expertise model. */
export const CLAIM_TYPES = [
	"employment",
	"education",
	"skill",
	"project",
	"tag",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

/** Persistence statuses for a Beacon claim. `pending` is shown as unverified. */
export const CLAIM_STATUSES = ["confirmed", "pending", "rejected"] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Human-readable status copy shared by profile and search surfaces. */
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
	confirmed: "Confirmed",
	pending: "Unverified",
	rejected: "Rejected",
};

export function getClaimStatusLabel(status: ClaimStatus): string {
	return CLAIM_STATUS_LABELS[status];
}

/** Provenance origins accepted by the Beacon source table. */
export const BEACON_SOURCE_KINDS = [
	"self",
	"csv",
	"github",
	"linkedin",
	"pdl",
	"blog",
	"web_search",
	"slack",
] as const;

export type BeaconSourceKind = (typeof BEACON_SOURCE_KINDS)[number];

export const beaconSourceSchema = z.object({
	id: z.string().uuid(),
	kind: z.enum(BEACON_SOURCE_KINDS),
	url: z.string().nullable(),
	title: z.string().nullable(),
	identity_confirmed: z.boolean(),
});

export type BeaconSource = z.infer<typeof beaconSourceSchema>;

const claimBaseSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	confidence: z.number().min(0).max(1),
	status: z.enum(CLAIM_STATUSES),
	raw_value: z.string().nullable(),
	source: beaconSourceSchema.nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

const employmentEntitySchema = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
		tags: z.array(z.string()),
		domain: z.string().nullable(),
	})
	.nullable();

export const employmentClaimSchema = claimBaseSchema.extend({
	organization_id: z.string().uuid().nullable(),
	title: z.string().nullable(),
	start_year: z.number().int().nullable(),
	end_year: z.number().int().nullable(),
	is_current: z.boolean(),
	organization: employmentEntitySchema,
});

export type EmploymentClaim = z.infer<typeof employmentClaimSchema>;

const educationEntitySchema = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
		groups: z.array(z.string()),
		country: z.string().nullable(),
	})
	.nullable();

export const educationClaimSchema = claimBaseSchema.extend({
	school_id: z.string().uuid().nullable(),
	degree: z.string().nullable(),
	field: z.string().nullable(),
	start_year: z.number().int().nullable(),
	end_year: z.number().int().nullable(),
	school: educationEntitySchema,
});

export type EducationClaim = z.infer<typeof educationClaimSchema>;

const skillEntitySchema = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
		category: z.string().nullable(),
	})
	.nullable();

export const skillClaimSchema = claimBaseSchema.extend({
	skill_id: z.string().uuid(),
	proficiency: z
		.enum(["beginner", "intermediate", "advanced", "expert"])
		.nullable(),
	skill: skillEntitySchema,
});

export type SkillClaim = z.infer<typeof skillClaimSchema>;

const projectEntitySchema = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
		url: z.string().nullable(),
		description: z.string().nullable(),
	})
	.nullable();

export const projectClaimSchema = claimBaseSchema.extend({
	project_id: z.string().uuid(),
	role: z.string().nullable(),
	project: projectEntitySchema,
});

export type ProjectClaim = z.infer<typeof projectClaimSchema>;

const tagVocabularySchema = z
	.object({
		tag: z.string(),
		label: z.string(),
		category: z.string().nullable(),
		description: z.string().nullable(),
	})
	.nullable();

export const tagClaimSchema = claimBaseSchema.extend({
	tag: z.string(),
	vocabulary: tagVocabularySchema,
});

export type TagClaim = z.infer<typeof tagClaimSchema>;

export const beaconPersonSchema = z.object({
	user_id: z.string().uuid(),
	headline: z.string().nullable(),
	summary: z.string().nullable(),
	opted_out: z.boolean(),
	consent_at: z.string().nullable(),
	last_enriched_at: z.string().nullable(),
});

export type BeaconPerson = z.infer<typeof beaconPersonSchema>;

/** Public member fields returned with a Beacon expertise profile. */
export const beaconMemberBasicSchema = z.object({
	user_id: z.string().uuid(),
	given_name: z.string().nullable(),
	surname: z.string().nullable(),
	department: z.string().nullable(),
	batch: z.string().nullable(),
	member_role: z.string().nullable(),
	board_role: z.string().nullable(),
	// The current profile route omits avatars; clients use initials as fallback.
	avatar_url: z.string().nullable().optional(),
	linkedin_profile_url: z.string().nullable(),
	linkedin_url: z.string().nullable(),
	public_location: z.string().nullable(),
	member_status: z.string().nullable(),
});

export type MemberBasic = z.infer<typeof beaconMemberBasicSchema>;

export const expertiseProfileSchema = z.object({
	user_id: z.string().uuid(),
	editable: z.boolean(),
	opted_out: z.boolean(),
	person: beaconPersonSchema.nullable(),
	member: beaconMemberBasicSchema.nullable(),
	employment: z.array(employmentClaimSchema),
	education: z.array(educationClaimSchema),
	skills: z.array(skillClaimSchema),
	projects: z.array(projectClaimSchema),
	tags: z.array(tagClaimSchema),
	counts: z.object({
		confirmed: z.number().int().nonnegative(),
		pending: z.number().int().nonnegative(),
		rejected: z.number().int().nonnegative(),
	}),
});

export type ExpertiseProfile = z.infer<typeof expertiseProfileSchema>;

export const tagVocabularyEntrySchema = z.object({
	tag: z.string(),
	label: z.string(),
	category: z.string().nullable(),
	description: z.string().nullable(),
});

export type TagVocabularyEntry = z.infer<typeof tagVocabularyEntrySchema>;

export const tagVocabularyResponseSchema = z.object({
	tags: z.array(tagVocabularyEntrySchema),
});

export type TagVocabularyResponse = z.infer<typeof tagVocabularyResponseSchema>;

export const composerMentionSchema = z.object({
	user_id: z.string().uuid(),
	label: z.string(),
});

export type ComposerMention = z.infer<typeof composerMentionSchema>;

export const searchRequestSchema = z.object({
	text: z.string().trim().min(1).max(1000),
	mentions: z.array(composerMentionSchema).default([]),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const searchPersonSchema = z.object({
	user_id: z.string().uuid(),
	name: z.string(),
	avatar_url: z.string().nullable(),
	best_chunk: z.string().nullable(),
	score: z.number(),
	match_reason: z.string().optional(),
});

export type SearchPerson = z.infer<typeof searchPersonSchema>;

export const searchResponseSchema = z.object({
	answer: z.string(),
	people: z.array(searchPersonSchema),
	dsl: z.record(z.string(), z.unknown()),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const personSuggestionSchema = z.object({
	user_id: z.string().uuid(),
	name: z.string(),
	avatar_url: z.string().nullable(),
});

export type PersonSuggestion = z.infer<typeof personSuggestionSchema>;

export const profilePatchSchema = z.object({
	headline: z.string().trim().max(200).nullish(),
	summary: z.string().trim().max(4000).nullish(),
});

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const optOutSchema = z.object({
	opted_out: z.boolean(),
});

export type OptOutRequest = z.infer<typeof optOutSchema>;

export const claimFieldSchemas = {
	employment: z.object({
		organization_name: z.string().trim().min(1).max(200).optional(),
		title: z.string().trim().max(200).optional(),
		start_year: z.number().int().min(1900).max(2100).optional(),
		end_year: z.number().int().min(1900).max(2100).optional(),
		is_current: z.boolean().optional(),
	}),
	education: z.object({
		school_name: z.string().trim().min(1).max(200).optional(),
		degree: z.string().trim().max(120).optional(),
		field: z.string().trim().max(200).optional(),
		start_year: z.number().int().min(1900).max(2100).optional(),
		end_year: z.number().int().min(1900).max(2100).optional(),
	}),
	skill: z.object({
		skill_name: z.string().trim().min(1).max(120).optional(),
		proficiency: z
			.enum(["beginner", "intermediate", "advanced", "expert"])
			.optional(),
	}),
	project: z.object({
		project_name: z.string().trim().min(1).max(200).optional(),
		url: z.string().trim().url().max(500).optional(),
		description: z.string().trim().max(2000).optional(),
		role: z.string().trim().max(200).optional(),
	}),
	tag: z.object({
		tag: z.string().trim().min(1).max(120).optional(),
	}),
} as const;

export type EmploymentClaimInput = z.infer<typeof claimFieldSchemas.employment>;
export type EducationClaimInput = z.infer<typeof claimFieldSchemas.education>;
export type SkillClaimInput = z.infer<typeof claimFieldSchemas.skill>;
export type ProjectClaimInput = z.infer<typeof claimFieldSchemas.project>;
export type TagClaimInput = z.infer<typeof claimFieldSchemas.tag>;
export type ClaimFieldInput =
	| EmploymentClaimInput
	| EducationClaimInput
	| SkillClaimInput
	| ProjectClaimInput
	| TagClaimInput;

export const assistantMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

export const assistantRequestSchema = z.object({
	messages: z.array(assistantMessageSchema).default([]),
	text: z.string().trim().min(1).max(2000),
	mentions: z.array(composerMentionSchema).default([]),
	loaded_pillars: z.array(z.string()).optional(),
	chat_id: z.string().uuid().optional(),
	turn_id: z.string().uuid().optional(),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const assistantEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("pillar_loaded"),
		pillar_id: z.string(),
		tools: z.array(z.string()),
	}),
	z.object({
		type: z.literal("tool_call"),
		id: z.string(),
		name: z.string(),
		args: z.unknown(),
	}),
	z.object({
		type: z.literal("tool_result"),
		id: z.string(),
		name: z.string(),
		summary: z.string(),
	}),
	z.object({
		type: z.literal("people"),
		people: z.array(searchPersonSchema),
	}),
	z.object({
		type: z.literal("answer"),
		text: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		message: z.string(),
	}),
	z.object({ type: z.literal("done") }),
]);

export type AssistantEvent = z.infer<typeof assistantEventSchema>;

/** JSON-only assistant response used by non-streaming callers and tests. */
export const assistantJsonResponseSchema = z.object({
	answer: z.string(),
	people: z.array(searchPersonSchema),
	steps: z.array(
		z.object({
			name: z.string(),
			args: z.unknown(),
			summary: z.string(),
		}),
	),
	loadedPillars: z.array(z.string()),
});

export type AssistantJsonResponse = z.infer<typeof assistantJsonResponseSchema>;

/** Alias matching the server's internal name for streamed events. */
export type AgentEvent = AssistantEvent;
