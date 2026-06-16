// Client-side shapes for the Beacon expertise profile API (server/src/routes/expertise.ts).

export type ClaimStatus = "confirmed" | "pending" | "rejected";
export type ClaimType =
	| "employment"
	| "education"
	| "skill"
	| "project"
	| "tag";

export interface BeaconSource {
	id: string;
	kind: string;
	url: string | null;
	title: string | null;
	identity_confirmed: boolean;
}

interface ClaimBase {
	id: string;
	user_id: string;
	confidence: number;
	status: ClaimStatus;
	raw_value: string | null;
	source: BeaconSource | null;
	created_at: string;
	updated_at: string;
}

export interface EmploymentClaim extends ClaimBase {
	organization_id: string | null;
	title: string | null;
	start_year: number | null;
	end_year: number | null;
	is_current: boolean;
	organization: {
		id: string;
		name: string;
		tags: string[];
		domain: string | null;
	} | null;
}

export interface EducationClaim extends ClaimBase {
	school_id: string | null;
	degree: string | null;
	field: string | null;
	start_year: number | null;
	end_year: number | null;
	school: {
		id: string;
		name: string;
		groups: string[];
		country: string | null;
	} | null;
}

export interface SkillClaim extends ClaimBase {
	skill_id: string;
	proficiency: string | null;
	skill: { id: string; name: string; category: string | null } | null;
}

export interface ProjectClaim extends ClaimBase {
	project_id: string;
	role: string | null;
	project: {
		id: string;
		name: string;
		url: string | null;
		description: string | null;
	} | null;
}

export interface TagClaim extends ClaimBase {
	tag: string;
	vocabulary: {
		tag: string;
		label: string;
		category: string | null;
		description: string | null;
	} | null;
}

export interface BeaconPerson {
	user_id: string;
	headline: string | null;
	summary: string | null;
	opted_out: boolean;
	consent_at: string | null;
	last_enriched_at: string | null;
}

export interface MemberBasic {
	user_id: string;
	given_name: string | null;
	surname: string | null;
	department: string | null;
	batch: string | null;
	member_role: string | null;
	board_role: string | null;
	avatar_url: string | null;
	linkedin_profile_url: string | null;
	linkedin_url: string | null;
	public_location: string | null;
	member_status: string | null;
}

export interface ExpertiseProfile {
	user_id: string;
	editable: boolean;
	opted_out: boolean;
	person: BeaconPerson | null;
	member: MemberBasic | null;
	employment: EmploymentClaim[];
	education: EducationClaim[];
	skills: SkillClaim[];
	projects: ProjectClaim[];
	tags: TagClaim[];
	counts: { confirmed: number; pending: number; rejected: number };
}

export interface TagVocabularyEntry {
	tag: string;
	label: string;
	category: string | null;
	description: string | null;
}

// ---- NL search / chat ----
export interface SearchPerson {
	user_id: string;
	name: string;
	avatar_url: string | null;
	best_chunk: string | null;
	score: number;
	match_reason?: string;
}

export interface SearchResponse {
	answer: string;
	people: SearchPerson[];
	dsl: Record<string, unknown>;
}

export interface PersonSuggestion {
	user_id: string;
	name: string;
	avatar_url: string | null;
}

// A person referenced in the composer (@-mention), bound to a real user_id.
export interface ComposerMention {
	user_id: string;
	label: string;
}

// A visible step in the assistant's live "thinking" trace (one tool call).
export interface AgentStep {
	id: string;
	label: string;
	status: "running" | "done";
}

// Mirror of the server's AgentEvent (lib/agent/types.ts) streamed over SSE.
export type AssistantEvent =
	| { type: "pillar_loaded"; pillar_id: string; tools: string[] }
	| { type: "tool_call"; id: string; name: string; args: unknown }
	| { type: "tool_result"; id: string; name: string; summary: string }
	| { type: "people"; people: SearchPerson[] }
	| { type: "answer"; text: string }
	| { type: "error"; message: string }
	| { type: "done" };

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	people?: SearchPerson[];
	pending?: boolean;
	/** The user query that produced this assistant turn (for regenerate). */
	query?: string;
	/** Live tool steps, surfaced in the "what I did" disclosure. */
	steps?: AgentStep[];
	/** Set once the streamed reveal has finished (so it doesn't re-type). */
	streamed?: boolean;
}
