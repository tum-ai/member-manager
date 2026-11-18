import type { UseFormReturn } from "react-hook-form";
import type { ProfileAuthPrefill } from "@/features/profile/profileTypes";
import { extractSlackProfileFromMetadata } from "@/features/profile/profileUtils";
import { getCurrentBatch } from "@/lib/constants";
import type { MemberSchema, ProfileSepaInput } from "@/lib/schemas";

type StoredRecord = Record<string, unknown> | null | undefined;

const textOf = (value: unknown): string =>
	typeof value === "string" ? value : "";

const storedText = (stored: StoredRecord, key: string): string =>
	textOf(stored?.[key]);

function trySuggestMemberField(
	memberForm: UseFormReturn<MemberSchema>,
	stored: StoredRecord,
	name: "given_name" | "surname" | "batch",
	suggestion: string,
): void {
	if (!suggestion.trim()) return;
	if (storedText(stored, name).trim()) return;
	if (memberForm.formState.dirtyFields[name]) return;
	const current = memberForm.getValues(name);
	if (typeof current === "string" && current.trim()) return;
	memberForm.setValue(name, suggestion, { shouldDirty: true });
}

/**
 * After a server baseline reset, prefill empty stored fields from Slack auth
 * metadata and the current batch. Marked dirty so the baseline stays "what
 * the server has" until the member saves.
 */
export function applyProfileFieldSuggestions(
	memberForm: UseFormReturn<MemberSchema>,
	memberData: StoredRecord,
	authMetadata: ProfileAuthPrefill,
): void {
	const slack = extractSlackProfileFromMetadata(authMetadata);
	trySuggestMemberField(memberForm, memberData, "given_name", slack.given_name);
	trySuggestMemberField(memberForm, memberData, "surname", slack.surname);
	trySuggestMemberField(memberForm, memberData, "batch", getCurrentBatch());
}

/**
 * The member form as it is stored. Nothing is invented here: a field the
 * member never saved is blank, so the form's baseline (and its dirty state)
 * always means "what the server has". Slack/batch suggestions are applied
 * after reset in `useProfileFormHydration` via `applyProfileFieldSuggestions`.
 */
export function toMemberFormValues(
	stored: StoredRecord,
	userId: string,
): MemberSchema {
	const existing = stored ?? {};
	const active = existing.active ?? true;

	return {
		active: Boolean(active),
		member_status:
			textOf(existing.member_status) || (active ? "active" : "inactive"),
		salutation: textOf(existing.salutation),
		title: textOf(existing.title),
		surname: textOf(existing.surname),
		given_name: textOf(existing.given_name),
		date_of_birth: textOf(existing.date_of_birth),
		street: textOf(existing.street),
		number: textOf(existing.number),
		postal_code: textOf(existing.postal_code),
		city: textOf(existing.city),
		country: textOf(existing.country) || "Germany",
		user_id: userId,
		batch: textOf(existing.batch),
		department: textOf(existing.department),
		member_role: textOf(existing.member_role),
		research_project_id: textOf(existing.research_project_id),
		degree: textOf(existing.degree),
		school: textOf(existing.school),
		reimbursement_slack_notifications_enabled:
			existing.reimbursement_slack_notifications_enabled === true,
		linkedin_profile_url: textOf(existing.linkedin_profile_url),
		public_location: textOf(existing.public_location),
	};
}

export function toSepaFormValues(stored: StoredRecord): ProfileSepaInput {
	const existing = stored ?? {};

	return {
		iban: textOf(existing.iban),
		bic: textOf(existing.bic),
		bank_name: textOf(existing.bank_name),
		mandate_agreed: existing.mandate_agreed === true,
		privacy_agreed: existing.privacy_agreed === true,
	};
}

export interface ProfileFormBaseline {
	member: MemberSchema;
	sepa: ProfileSepaInput;
}

/** Single server → form mapping (see `applyProfileFieldSuggestions`). */
export function toProfileFormValues(
	member: StoredRecord,
	sepa: StoredRecord,
	userId: string,
): ProfileFormBaseline {
	return {
		member: toMemberFormValues(member, userId),
		sepa: toSepaFormValues(sepa),
	};
}

interface BuildSelfServiceMemberUpdatePayloadOptions {
	includeAdminManagedFields?: boolean;
}

export function buildSelfServiceMemberUpdatePayload(
	values: Partial<MemberSchema>,
	options: BuildSelfServiceMemberUpdatePayloadOptions = {},
): Partial<MemberSchema> {
	const {
		member_status: _memberStatus,
		active: _active,
		...editableValues
	} = values;

	if (options.includeAdminManagedFields) {
		return editableValues;
	}

	// member_role and department are admin-managed. Members request changes to
	// them via member_change_requests, so they must never be sent through the
	// self-service profile update.
	const {
		member_role: _memberRole,
		department: _department,
		...selfServiceValues
	} = editableValues;

	return selfServiceValues;
}

interface ProfileCompletenessInput {
	member: Partial<MemberSchema>;
	sepa: {
		iban?: string;
		bank_name?: string;
		mandate_agreed?: boolean;
		privacy_agreed?: boolean;
	};
	/** The member has saved a Data Privacy Notice decision (any answer counts). */
	consentsDecided: boolean;
}

interface CompletenessField {
	label: string;
	filled: boolean;
}

// Single source of truth for which fields count toward completeness, shared
// by computeProfileCompleteness (the percentage) and getMissingProfileFields
// (the breakdown of what's still needed to reach 100%).
function getCompletenessFields({
	member,
	sepa,
	consentsDecided,
}: ProfileCompletenessInput): CompletenessField[] {
	const isFilledText = (value: string | null | undefined) =>
		Boolean(value?.trim());

	return [
		{ label: "First name", filled: isFilledText(member.given_name) },
		{ label: "Last name", filled: isFilledText(member.surname) },
		{ label: "Date of birth", filled: isFilledText(member.date_of_birth) },
		{ label: "Street", filled: isFilledText(member.street) },
		{ label: "House number", filled: isFilledText(member.number) },
		{ label: "Postal code", filled: isFilledText(member.postal_code) },
		{ label: "City", filled: isFilledText(member.city) },
		{ label: "Country", filled: isFilledText(member.country) },
		{ label: "TUM.ai batch", filled: isFilledText(member.batch) },
		// Study/education: a real degree counts; an explicit "None" serializes to
		// "" (EducationFields NONE_VALUE) and so does not count — same trim rule
		// as every other select-backed field below.
		{ label: "Degree", filled: isFilledText(member.degree) },
		// department and member_role are admin-managed (stripped from
		// self-service updates), so a member can never fill them in — excluded
		// from completeness so a fully-filled editable profile reaches 100%.
		{
			label: "LinkedIn profile",
			filled: isFilledText(member.linkedin_profile_url),
		},
		{
			label: "Public location",
			filled: isFilledText(member.public_location),
		},
		{ label: "IBAN", filled: isFilledText(sepa.iban) },
		{ label: "Bank name", filled: isFilledText(sepa.bank_name) },
		{
			label: "SEPA mandate agreement",
			filled: Boolean(sepa.mandate_agreed),
		},
		{ label: "Privacy agreement", filled: Boolean(sepa.privacy_agreed) },
		// Each purpose is optional, so a refusal still completes this item.
		{ label: "Data privacy consent choices", filled: consentsDecided },
	];
}

// Share of "key" profile fields a member has filled in, as an integer 0–100.
// Drives the completeness meter in the profile sidebar.
export function computeProfileCompleteness(
	input: ProfileCompletenessInput,
): number {
	const fields = getCompletenessFields(input);
	const filled = fields.filter((field) => field.filled).length;

	return Math.round((filled / fields.length) * 100);
}

// Labels of the fields still missing, for the "what's left" breakdown next
// to the completeness meter.
export function getMissingProfileFields(
	input: ProfileCompletenessInput,
): string[] {
	return getCompletenessFields(input)
		.filter((field) => !field.filled)
		.map((field) => field.label);
}
