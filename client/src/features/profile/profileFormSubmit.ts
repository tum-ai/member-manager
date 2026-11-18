import {
	BANK_DETAILS_REMOVAL_MESSAGE,
	hasBankDetailsInput,
} from "@member-manager/shared";
import type { UseFormReturn } from "react-hook-form";
import { buildSelfServiceMemberUpdatePayload } from "@/features/profile/profileFormUtils";
import {
	normalizeSerializedTextValue,
	normalizeTextValue,
} from "@/features/profile/profileUtils";
import {
	getEducationEntries,
	resolveDepartmentForMemberRole,
	serializeEducationEntries,
} from "@/lib/memberMetadata";
import type { MemberSchema, ProfileSepaInput } from "@/lib/schemas";
import { profileSepaSchema } from "@/lib/schemas";

export const PROFILE_AGREEMENT_FIELDS = [
	"mandate_agreed",
	"privacy_agreed",
] as const;

export type SavePartStatus = "saved" | "skipped" | "failed";

export interface SavePart {
	status: SavePartStatus;
	message?: string;
}

export interface SaveFeedback {
	message: string;
	type: "success" | "error";
}

export function toSavePart(
	result: PromiseSettledResult<unknown> | "skipped",
): SavePart {
	if (result === "skipped") return { status: "skipped" };
	if (result.status === "fulfilled") return { status: "saved" };
	return {
		status: "failed",
		message:
			result.reason instanceof Error ? result.reason.message : "Unknown error",
	};
}

export function describeSaveOutcome(parts: {
	member: SavePart;
	sepa: SavePart;
}): SaveFeedback {
	const { member, sepa } = parts;
	if (member.status !== "failed" && sepa.status !== "failed") {
		return { message: "Profile saved successfully!", type: "success" };
	}
	if (member.status === "failed" && sepa.status === "saved") {
		return {
			message: `Bank details saved, but your profile was not: ${member.message}`,
			type: "error",
		};
	}
	if (member.status === "saved" && sepa.status === "failed") {
		return {
			message: `Profile saved, but your bank details were not: ${sepa.message}`,
			type: "error",
		};
	}
	return {
		message: `Error saving: ${member.message ?? sepa.message}`,
		type: "error",
	};
}

export async function validateProfileBeforeSave({
	memberForm,
	sepaForm,
	sepaData,
	hasSavedBankDetails,
}: {
	memberForm: UseFormReturn<MemberSchema>;
	sepaForm: UseFormReturn<ProfileSepaInput>;
	// biome-ignore lint/suspicious/noExplicitAny: API row
	sepaData: any;
	hasSavedBankDetails: boolean;
}): Promise<
	| { ok: true; sepaValues: ProfileSepaInput; sendsSepa: boolean }
	| { ok: false; toastMessage: string }
> {
	const memberValid = await memberForm.trigger();
	const sepaSchemaValid = await sepaForm.trigger();
	const sepaValues = sepaForm.getValues();
	const includeBankDetails = hasBankDetailsInput(sepaValues);
	const agreementsChanged = PROFILE_AGREEMENT_FIELDS.some(
		(field) => Boolean(sepaValues[field]) !== Boolean(sepaData?.[field]),
	);
	const isRemovingSavedBankDetails = hasSavedBankDetails && !includeBankDetails;
	if (isRemovingSavedBankDetails) {
		sepaForm.setError("iban", {
			type: "manual",
			message: BANK_DETAILS_REMOVAL_MESSAGE,
		});
	}
	const sepaValid = sepaSchemaValid && !isRemovingSavedBankDetails;

	if (!memberValid || !sepaValid) {
		let toastMessage =
			"Please complete all required profile fields before saving.";
		if (isRemovingSavedBankDetails) {
			toastMessage = BANK_DETAILS_REMOVAL_MESSAGE;
		} else if (!sepaValid) {
			toastMessage =
				"Please complete all required fields and agreements before saving.";
		}
		return { ok: false, toastMessage };
	}

	return {
		ok: true,
		sepaValues,
		sendsSepa: includeBankDetails || agreementsChanged,
	};
}

export function buildProfileMemberPayload(
	memberValues: MemberSchema,
	isAdmin: boolean,
): Record<string, unknown> {
	const educationValues = serializeEducationEntries(
		getEducationEntries(memberValues.degree, memberValues.school),
	);
	const payload: Record<string, unknown> = {
		...buildSelfServiceMemberUpdatePayload(memberValues, {
			includeAdminManagedFields: isAdmin,
		}),
		degree: normalizeSerializedTextValue(educationValues.degree),
		school: normalizeSerializedTextValue(educationValues.school),
		linkedin_profile_url: normalizeTextValue(memberValues.linkedin_profile_url),
		public_location: normalizeTextValue(memberValues.public_location),
	};

	let effectiveDepartment = normalizeTextValue(memberValues.department);
	if (isAdmin) {
		Object.assign(payload, {
			batch: normalizeTextValue(memberValues.batch),
		});
		const normalizedRole = normalizeTextValue(memberValues.member_role);
		effectiveDepartment = resolveDepartmentForMemberRole(
			normalizedRole || "Member",
			normalizeTextValue(memberValues.department),
		);
		Object.assign(payload, {
			member_role: normalizedRole || "Member",
			department: effectiveDepartment,
		});
	}
	if (effectiveDepartment === "Research") {
		Object.assign(payload, {
			research_project_id: normalizeTextValue(memberValues.research_project_id),
		});
	} else if (isAdmin) {
		Object.assign(payload, { research_project_id: null });
	} else {
		delete payload.research_project_id;
	}
	return payload;
}

export function parseProfileSepaForSave(values: ProfileSepaInput) {
	return profileSepaSchema.parse(values);
}
