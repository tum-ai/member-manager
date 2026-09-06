export type {
	AssistantEvent,
	AssistantJsonResponse,
	AssistantMessage,
	AssistantRequest,
	BeaconPerson,
	BeaconSource,
	ClaimFieldInput,
	ClaimStatus,
	ClaimType,
	ComposerMention,
	EducationClaim,
	EmploymentClaim,
	ExpertiseProfile,
	MemberBasic,
	PersonSuggestion,
	ProfilePatch,
	ProjectClaim,
	SearchPerson,
	SearchRequest,
	SearchResponse,
	SkillClaim,
	TagClaim,
	TagVocabularyEntry,
} from "@member-manager/shared";

import type {
	BeaconSource,
	ClaimStatus,
	ClaimType,
	SearchPerson,
} from "@member-manager/shared";

/** One visible tool action in an in-progress assistant turn. */
export interface AgentStep {
	id: string;
	label: string;
	status: "running" | "done";
}

/** Client-only conversation state layered over shared Beacon transport types. */
export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	people?: SearchPerson[];
	pending?: boolean;
	query?: string;
	steps?: AgentStep[];
}

/** Dialog state for adding or editing a persisted expertise claim. */
export interface ClaimDialogState {
	type: ClaimType;
	prefill?: Record<string, unknown> | null;
	id?: string;
}

/** Presentation model shared by profile claim sections and review queue. */
export interface ClaimRowModel {
	key: string;
	type: ClaimType;
	id: string;
	title: string;
	subtitle?: string | null;
	entityTags?: string[];
	status: ClaimStatus;
	confidence: number;
	source: BeaconSource | null;
	prefill: Record<string, unknown>;
}
