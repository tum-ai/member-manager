import { zodResolver } from "@hookform/resolvers/zod";
import {
	isValidIsoDate,
	LINKEDIN_PROFILE_URL_REGEX,
	MEMBER_BATCH_REGEX,
	type ProfileResponse,
	type ProfileUpdateInput,
	profileSepaSchema,
} from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";
import {
	extractSlackProfile,
	normalizeSerializedTextValue,
	normalizeTextValue,
} from "@/features/profile/profileUtils";
import { getCurrentBatch } from "@/lib/constants";
import {
	getEducationEntries,
	resolveDepartmentForMemberRole,
	serializeEducationEntries,
} from "@/lib/memberMetadata";

/**
 * One flat model for everything the profile page edits. Flat on purpose:
 * react-hook-form's `keepDirtyValues` (see `useServerBackedForm`) has known
 * gaps for nested values.
 */
export interface ProfileFormValues {
	salutation: string;
	title: string;
	given_name: string;
	surname: string;
	date_of_birth: string;
	street: string;
	number: string;
	postal_code: string;
	city: string;
	country: string;
	batch: string;
	department: string;
	member_role: string;
	research_project_id: string;
	degree: string;
	school: string;
	reimbursement_slack_notifications_enabled: boolean;
	linkedin_profile_url: string;
	public_location: string;
	iban: string;
	bic: string;
	bank_name: string;
	mandate_agreed: boolean;
	privacy_agreed: boolean;
}

export const EMPTY_PROFILE_FORM_VALUES: ProfileFormValues = {
	salutation: "",
	title: "",
	given_name: "",
	surname: "",
	date_of_birth: "",
	street: "",
	number: "",
	postal_code: "",
	city: "",
	country: "Germany",
	batch: "",
	department: "",
	member_role: "",
	research_project_id: "",
	degree: "",
	school: "",
	reimbursement_slack_notifications_enabled: false,
	linkedin_profile_url: "",
	public_location: "",
	iban: "",
	bic: "",
	bank_name: "",
	mandate_agreed: false,
	privacy_agreed: false,
};

// --- Validation -------------------------------------------------------------

const profileFieldsSchema = z.object({
	salutation: z.string(),
	title: z.string(),
	given_name: z.string().min(1, "Given Name is required"),
	surname: z.string().min(1, "Surname is required"),
	date_of_birth: z
		.string()
		.refine(
			(value) => value.trim() === "" || isValidIsoDate(value),
			"Invalid date",
		),
	street: z.string(),
	number: z.string(),
	postal_code: z.string(),
	city: z.string(),
	country: z.string(),
	batch: z
		.string()
		.refine(
			(value) => value === "" || MEMBER_BATCH_REGEX.test(value),
			"Choose a valid batch",
		),
	department: z.string(),
	member_role: z.string(),
	research_project_id: z.string(),
	degree: z.string(),
	school: z.string(),
	reimbursement_slack_notifications_enabled: z.boolean(),
	linkedin_profile_url: z
		.string()
		.refine(
			(value) =>
				value.trim() === "" || LINKEDIN_PROFILE_URL_REGEX.test(value.trim()),
			"Must be a valid LinkedIn profile URL (https://linkedin.com/in/…)",
		),
	public_location: z.string(),
});

const fieldsResolver = zodResolver(profileFieldsSchema);
// Bank details are optional as a group; once a bank field is filled the group
// is validated like the SEPA schema (shared contract, same rules as the API).
const bankResolver = zodResolver(profileSepaSchema);

/** Validates the personal fields and the bank group in one pass. */
export const profileFormResolver: Resolver<ProfileFormValues> = async (
	values,
	context,
	options,
) => {
	const [fields, bank] = await Promise.all([
		fieldsResolver(values, context, options as never),
		bankResolver(values, context, options as never),
	]);
	const errors = {
		...fields.errors,
		...bank.errors,
	} as FieldErrors<ProfileFormValues>;

	if (Object.keys(errors).length > 0) {
		return { values: {}, errors };
	}
	return { values, errors: {} };
};

// --- Server snapshot -> form ------------------------------------------------

/** Values the form may offer when nothing is stored yet. Never saved implicitly. */
export interface ProfileSuggestions {
	given_name: string;
	surname: string;
	batch: string;
}

export type SuggestedField = keyof ProfileSuggestions;

export function getProfileSuggestions(user: User): ProfileSuggestions {
	const slack = extractSlackProfile(user);
	return {
		given_name: slack.given_name,
		surname: slack.surname,
		batch: getCurrentBatch(),
	};
}

const SUGGESTED_FIELDS: readonly SuggestedField[] = [
	"given_name",
	"surname",
	"batch",
];

const isBlank = (value: unknown) =>
	typeof value !== "string" || value.trim() === "";

/**
 * The fields that are only prefilled from a suggestion because nothing is
 * stored. They show in the form but do not count toward completeness until
 * the member saves.
 */
export function getSuggestedFields(
	profile: ProfileResponse | undefined,
	suggestions: ProfileSuggestions,
): SuggestedField[] {
	return SUGGESTED_FIELDS.filter(
		(field) => isBlank(profile?.member[field]) && suggestions[field] !== "",
	);
}

export function toFormValues(
	profile: ProfileResponse | undefined,
	suggestions: ProfileSuggestions,
): ProfileFormValues {
	const member = profile?.member;
	const sepa = profile?.sepa;
	const text = (value: unknown): string =>
		typeof value === "string" ? value : "";

	return {
		salutation: text(member?.salutation),
		title: text(member?.title),
		given_name: text(member?.given_name) || suggestions.given_name,
		surname: text(member?.surname) || suggestions.surname,
		date_of_birth: text(member?.date_of_birth),
		street: text(member?.street),
		number: text(member?.number),
		postal_code: text(member?.postal_code),
		city: text(member?.city),
		country: text(member?.country) || "Germany",
		batch: text(member?.batch) || suggestions.batch,
		department: text(member?.department),
		member_role: text(member?.member_role),
		research_project_id: text(member?.research_project_id),
		degree: text(member?.degree),
		school: text(member?.school),
		reimbursement_slack_notifications_enabled:
			member?.reimbursement_slack_notifications_enabled ?? false,
		linkedin_profile_url: text(member?.linkedin_profile_url),
		public_location: text(member?.public_location),
		iban: sepa?.iban ?? "",
		bic: sepa?.bic ?? "",
		bank_name: sepa?.bank_name ?? "",
		mandate_agreed: sepa?.mandate_agreed ?? false,
		privacy_agreed: sepa?.privacy_agreed ?? false,
	};
}

// --- Form -> save request ---------------------------------------------------

export interface UpdatePayloadOptions {
	/** The profile version the form was loaded from. */
	version: number;
	isAdmin: boolean;
}

/**
 * Builds the `PUT /api/profile/:userId` body. The server is the authority on
 * what each caller may write; this only leaves out what a member could never
 * change (role/department) so the request says what the user meant.
 */
export function toUpdatePayload(
	values: ProfileFormValues,
	{ version, isAdmin }: UpdatePayloadOptions,
): ProfileUpdateInput {
	const education = serializeEducationEntries(
		getEducationEntries(values.degree, values.school),
	);

	const member: ProfileUpdateInput["member"] = {
		salutation: values.salutation,
		title: values.title,
		given_name: values.given_name,
		surname: values.surname,
		date_of_birth: values.date_of_birth,
		street: values.street,
		number: values.number,
		postal_code: values.postal_code,
		city: values.city,
		country: values.country,
		batch: normalizeTextValue(values.batch),
		degree: normalizeSerializedTextValue(education.degree),
		school: normalizeSerializedTextValue(education.school),
		reimbursement_slack_notifications_enabled:
			values.reimbursement_slack_notifications_enabled,
		linkedin_profile_url: normalizeTextValue(values.linkedin_profile_url),
		public_location: normalizeTextValue(values.public_location),
	};

	let effectiveDepartment = normalizeTextValue(values.department);
	if (isAdmin) {
		const role = normalizeTextValue(values.member_role) || "Member";
		effectiveDepartment = resolveDepartmentForMemberRole(
			role,
			effectiveDepartment,
		);
		member.member_role = role as ProfileUpdateInput["member"]["member_role"];
		member.department = effectiveDepartment;
	}

	if (effectiveDepartment === "Research") {
		member.research_project_id = normalizeTextValue(values.research_project_id);
	} else if (isAdmin) {
		member.research_project_id = null;
	}

	return {
		version,
		member,
		sepa: {
			iban: values.iban,
			bic: values.bic,
			bank_name: values.bank_name,
			mandate_agreed: values.mandate_agreed,
			privacy_agreed: values.privacy_agreed,
		},
	};
}
