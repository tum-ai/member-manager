import { zodResolver } from "@hookform/resolvers/zod";
import {
	BANK_DETAILS_REMOVAL_MESSAGE,
	hasBankDetailsInput,
	type MemberConsents,
} from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import {
	buildLinkedinFormValues,
	buildMemberFormValues,
	buildSelfServiceMemberUpdatePayload,
	buildSepaFormValues,
	computeProfileCompleteness,
	getMissingProfileFields,
} from "@/features/profile/profileFormUtils";
import {
	describeSaveOutcome,
	toSavePart,
} from "@/features/profile/profileSaveResult";
import {
	extractSlackProfile,
	normalizeSerializedTextValue,
	normalizeTextValue,
} from "@/features/profile/profileUtils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMemberConsents } from "@/hooks/useMemberConsents";
import { useMemberData } from "@/hooks/useMemberData";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { useSepaData } from "@/hooks/useSepaData";
import { getCurrentBatch } from "@/lib/constants";
import {
	isLinkedinProfileUrl,
	normalizeLinkedinProfileUrl,
} from "@/lib/linkedin";
import {
	getEducationEntries,
	resolveDepartmentForMemberRole,
	serializeEducationEntries,
} from "@/lib/memberMetadata";
import { getResearchProjectSelectValue } from "@/lib/researchProjects";
import {
	type LinkedinSchema,
	linkedinSchema,
	type MemberSchema,
	memberSchema,
	type ProfileSepaInput,
	profileSepaSchema,
} from "@/lib/schemas";
import type { ResearchProject } from "@/types";

// The Data Privacy Notice consents are not part of the profile form: they are
// managed per purpose on /welcome (`useMemberConsents`), and the profile only
// summarises them. Leaving them out keeps a profile save from touching them.
const AGREEMENT_FIELDS = ["mandate_agreed", "privacy_agreed"] as const;

export interface UseProfileFormResult {
	memberForm: UseFormReturn<MemberSchema>;
	linkedinForm: UseFormReturn<LinkedinSchema>;
	sepaForm: UseFormReturn<ProfileSepaInput>;
	// biome-ignore lint/suspicious/noExplicitAny: member is untyped API data
	memberData: any;
	isAdmin: boolean;
	isLoading: boolean;
	isUpdating: boolean;
	isLoadingResearchProjects: boolean;
	onSubmit: () => Promise<void>;
	/** True while any form differs from what the server last returned. */
	isDirty: boolean;
	completeness: number;
	missingProfileFields: string[];
	normalizedLinkedinUrl: string;
	isLinkedinUrlValid: boolean;
	currentRole: string;
	currentDepartment: string;
	isResearchDepartmentSelected: boolean;
	researchProjectOptions: ResearchProject[];
	researchProjectSelectValue: string;
	memberConsents: MemberConsents | undefined;
}

export function useProfileForm(user: User): UseProfileFormResult {
	const { showToast } = useToast();

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(user.id);
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(user.id);
	const { consents: memberConsents } = useMemberConsents(user.id);
	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();
	const {
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: isUpdatingSepa,
	} = useSepaData(user.id);

	const linkedinForm = useForm<LinkedinSchema>({
		resolver: zodResolver(linkedinSchema),
		defaultValues: {
			linkedin_profile_url: "",
			public_location: "",
		},
	});

	const linkedinUrl = linkedinForm.watch("linkedin_profile_url");
	const normalizedLinkedinUrl = normalizeLinkedinProfileUrl(linkedinUrl);
	const isLinkedinUrlValid = isLinkedinProfileUrl(linkedinUrl);

	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: {
			active: true,
			member_status: "active",
			salutation: "",
			title: "",
			surname: "",
			given_name: "",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "Germany",
			user_id: user.id,
			batch: "",
			department: "",
			member_role: "",
			degree: "",
			school: "",
			reimbursement_slack_notifications_enabled: false,
		},
	});

	// Bank details are optional as a group. Once a bank field is filled,
	// profileSepaSchema requires a valid IBAN, a bank name and all three
	// agreements; without bank details the agreements can be saved alone.
	const sepaForm = useForm<ProfileSepaInput>({
		resolver: zodResolver(profileSepaSchema),
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
		},
	});

	// Once bank details are stored they can be edited but not cleared; the
	// server enforces the same rule.
	const hasSavedBankDetails = hasBankDetailsInput(sepaData ?? {});

	// Slack-derived name suggestions are read as primitives: `user` gets a new
	// identity on every auth event (App.tsx), which must not re-run the effect.
	const { given_name: slackGivenName, surname: slackSurname } =
		extractSlackProfile(user);
	const suggestionsAppliedFor = useRef<string | null>(null);

	// The server is the baseline. `keepDirtyValues` makes a refetch (window
	// focus, a save in another tab) update untouched fields while whatever the
	// member is typing stays, so nothing unsaved is overwritten (#397).
	useEffect(() => {
		if (isLoadingMember) return;

		memberForm.reset(buildMemberFormValues(memberData, user.id), {
			keepDirtyValues: true,
		});
		linkedinForm.reset(buildLinkedinFormValues(memberData), {
			keepDirtyValues: true,
		});

		// Suggestions (Slack name, current batch) are offered once per page
		// visit, as unsaved edits: they show in the form and the completeness
		// meter, flag the page as having unsaved changes, and only reach the
		// server with the next save.
		if (suggestionsAppliedFor.current === user.id) return;
		suggestionsAppliedFor.current = user.id;
		const stored = buildMemberFormValues(memberData, user.id);
		const suggestions = {
			surname: slackSurname,
			given_name: slackGivenName,
			batch: getCurrentBatch(),
		} as const;
		for (const field of Object.keys(suggestions) as Array<
			keyof typeof suggestions
		>) {
			if (!stored[field] && !memberForm.getValues(field)) {
				memberForm.setValue(field, suggestions[field], { shouldDirty: true });
			}
		}
	}, [
		memberData,
		isLoadingMember,
		memberForm,
		linkedinForm,
		user.id,
		slackGivenName,
		slackSurname,
	]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset(buildSepaFormValues(sepaData), { keepDirtyValues: true });
		}
	}, [sepaData, sepaForm]);

	const onSubmit = async (): Promise<void> => {
		try {
			const memberValid = await memberForm.trigger();
			const linkedinValid = await linkedinForm.trigger();
			const sepaSchemaValid = await sepaForm.trigger();

			const sepaValues = sepaForm.getValues();
			const includeBankDetails = hasBankDetailsInput(sepaValues);
			const agreementsChanged = AGREEMENT_FIELDS.some(
				(field) => Boolean(sepaValues[field]) !== Boolean(sepaData?.[field]),
			);
			const isRemovingSavedBankDetails =
				hasSavedBankDetails && !includeBankDetails;
			if (isRemovingSavedBankDetails) {
				sepaForm.setError("iban", {
					type: "manual",
					message: BANK_DETAILS_REMOVAL_MESSAGE,
				});
			}
			const sepaValid = sepaSchemaValid && !isRemovingSavedBankDetails;

			if (!memberValid || !linkedinValid || !sepaValid) {
				let message =
					"Please complete all required profile fields before saving.";
				if (isRemovingSavedBankDetails) {
					message = BANK_DETAILS_REMOVAL_MESSAGE;
				} else if (!sepaValid) {
					message =
						"Please complete all required fields and agreements before saving.";
				}
				showToast(message, "error");
				return;
			}

			const memberValues = memberForm.getValues();
			const linkedinValues = linkedinForm.getValues();
			const educationValues = serializeEducationEntries(
				getEducationEntries(memberValues.degree, memberValues.school),
			);
			const memberPayload = {
				...buildSelfServiceMemberUpdatePayload(memberValues, {
					includeAdminManagedFields: isAdmin,
				}),
				degree: normalizeSerializedTextValue(educationValues.degree),
				school: normalizeSerializedTextValue(educationValues.school),
				// LinkedIn fields submitted with the member payload
				linkedin_profile_url: normalizeTextValue(
					linkedinValues.linkedin_profile_url,
				),
				public_location: normalizeTextValue(linkedinValues.public_location),
			};
			let effectiveProfileDepartment = normalizeTextValue(
				memberValues.department,
			);
			if (isAdmin) {
				Object.assign(memberPayload, {
					batch: normalizeTextValue(memberValues.batch),
				});
				const normalizedRole = normalizeTextValue(memberValues.member_role);
				effectiveProfileDepartment = resolveDepartmentForMemberRole(
					normalizedRole || "Member",
					normalizeTextValue(memberValues.department),
				);
				Object.assign(memberPayload, {
					member_role: normalizedRole || "Member",
					department: effectiveProfileDepartment,
				});
			}
			if (effectiveProfileDepartment === "Research") {
				Object.assign(memberPayload, {
					research_project_id: normalizeTextValue(
						memberValues.research_project_id,
					),
				});
			} else if (isAdmin) {
				Object.assign(memberPayload, { research_project_id: null });
			} else {
				delete memberPayload.research_project_id;
			}
			// With blank bank fields the PUT saves only the agreements, so it is
			// skipped entirely when those are unchanged too.
			const sendsSepa = includeBankDetails || agreementsChanged;
			const [memberResult, sepaResult] = await Promise.allSettled([
				updateMemberAsync(memberPayload),
				sendsSepa
					? updateSepaAsync(profileSepaSchema.parse(sepaValues))
					: Promise.resolve(),
			]);
			// A part that was saved becomes the new baseline, so the page stops
			// reporting unsaved changes; a part that failed stays dirty.
			if (memberResult.status === "fulfilled") {
				const saved = memberResult.value as Record<string, unknown> | undefined;
				memberForm.reset(
					saved ? buildMemberFormValues(saved, user.id) : memberValues,
				);
				linkedinForm.reset(
					saved ? buildLinkedinFormValues(saved) : linkedinValues,
				);
			}
			if (sendsSepa && sepaResult.status === "fulfilled") {
				const saved = sepaResult.value as Record<string, unknown> | undefined;
				sepaForm.reset(saved ? buildSepaFormValues(saved) : sepaValues);
			}
			const feedback = describeSaveOutcome({
				member: toSavePart(memberResult),
				sepa: toSavePart(sendsSepa ? sepaResult : "skipped"),
			});
			showToast(feedback.message, feedback.type);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error saving: ${errorMessage}`, "error");
		}
	};

	const isLoading = isLoadingMember || isLoadingSepa || isLoadingAdminRole;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	const completenessInput = {
		member: memberForm.watch(),
		linkedin: linkedinForm.watch(),
		sepa: sepaForm.watch(),
		consentsDecided: Boolean(memberConsents?.consents_decided_at),
	};
	const isDirty =
		memberForm.formState.isDirty ||
		linkedinForm.formState.isDirty ||
		sepaForm.formState.isDirty;
	const completeness = computeProfileCompleteness(completenessInput);
	const missingProfileFields = getMissingProfileFields(completenessInput);
	const currentRole = memberForm.watch("member_role") || "Member";
	const currentDepartment = memberForm.watch("department") || "";
	const effectiveProfileDepartment = resolveDepartmentForMemberRole(
		currentRole,
		currentDepartment,
	);
	const researchProjectOptions = (researchProjects ?? []).filter((project) => {
		const status = project.status?.trim().toLowerCase();
		return !status || ["ongoing", "active", "in progress"].includes(status);
	});
	const researchProjectSelectValue = getResearchProjectSelectValue(
		memberForm.watch("research_project_id"),
		researchProjectOptions,
	);
	const isResearchDepartmentSelected =
		effectiveProfileDepartment === "Research";

	return {
		memberForm,
		linkedinForm,
		sepaForm,
		memberData,
		isAdmin,
		isLoading,
		isUpdating,
		isLoadingResearchProjects,
		onSubmit,
		isDirty,
		completeness,
		missingProfileFields,
		normalizedLinkedinUrl,
		isLinkedinUrlValid,
		currentRole,
		currentDepartment,
		isResearchDepartmentSelected,
		researchProjectOptions,
		researchProjectSelectValue,
		memberConsents,
	};
}
