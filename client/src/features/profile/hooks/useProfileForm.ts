import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import { useEffect } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import {
	buildSelfServiceMemberUpdatePayload,
	computeProfileCompleteness,
} from "@/features/profile/profileFormUtils";
import {
	extractSlackProfile,
	normalizeSerializedTextValue,
	normalizeTextValue,
} from "@/features/profile/profileUtils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
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
	type SepaSchema,
	sepaSchema,
} from "@/lib/schemas";
import type { ResearchProject } from "@/types";

export interface UseProfileFormResult {
	memberForm: UseFormReturn<MemberSchema>;
	linkedinForm: UseFormReturn<LinkedinSchema>;
	sepaForm: UseFormReturn<SepaSchema>;
	// biome-ignore lint/suspicious/noExplicitAny: member is untyped API data
	memberData: any;
	isAdmin: boolean;
	isLoading: boolean;
	isUpdating: boolean;
	isLoadingResearchProjects: boolean;
	onSubmit: () => Promise<void>;
	completeness: number;
	normalizedLinkedinUrl: string;
	isLinkedinUrlValid: boolean;
	currentRole: string;
	currentDepartment: string;
	isResearchDepartmentSelected: boolean;
	researchProjectOptions: ResearchProject[];
	researchProjectSelectValue: string;
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

	const sepaForm = useForm<SepaSchema>({
		resolver: zodResolver(sepaSchema),
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
			user_id: user.id,
		},
	});

	const shouldSubmitSepa = Boolean(sepaData) || sepaForm.formState.isDirty;

	useEffect(() => {
		if (isLoadingMember) return;

		const slackProfile = extractSlackProfile(user);
		const slackBatch = getCurrentBatch();
		const existing = memberData ?? {};

		memberForm.reset({
			active: existing.active ?? true,
			member_status:
				existing.member_status || (existing.active ? "active" : "inactive"),
			salutation: existing.salutation || "",
			title: existing.title || "",
			surname: existing.surname || slackProfile.surname,
			given_name: existing.given_name || slackProfile.given_name,
			date_of_birth: existing.date_of_birth || "",
			street: existing.street || "",
			number: existing.number || "",
			postal_code: existing.postal_code || "",
			city: existing.city || "",
			country: existing.country || "Germany",
			user_id: user.id,
			batch: existing.batch || slackBatch,
			department: existing.department || "",
			member_role: existing.member_role || "",
			research_project_id: existing.research_project_id || "",
			degree: existing.degree || "",
			school: existing.school || "",
			reimbursement_slack_notifications_enabled:
				existing.reimbursement_slack_notifications_enabled ?? false,
		});

		// Populate LinkedIn form from DB data
		linkedinForm.reset({
			linkedin_profile_url:
				((existing as Record<string, unknown>)
					.linkedin_profile_url as string) || "",
			public_location:
				((existing as Record<string, unknown>).public_location as string) || "",
		});
	}, [memberData, isLoadingMember, memberForm, linkedinForm, user]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset({
				iban: sepaData.iban || "",
				bic: sepaData.bic || "",
				bank_name: sepaData.bank_name || "",
				mandate_agreed: sepaData.mandate_agreed || false,
				privacy_agreed: sepaData.privacy_agreed || false,
				data_privacy_notice_agreed:
					sepaData.data_privacy_notice_agreed || false,
				user_id: user.id,
			});
		}
	}, [sepaData, sepaForm, user.id]);

	const onSubmit = async (): Promise<void> => {
		try {
			const memberValid = await memberForm.trigger();
			const linkedinValid = await linkedinForm.trigger();
			const sepaValid = shouldSubmitSepa ? await sepaForm.trigger() : true;

			if (!memberValid || !linkedinValid || !sepaValid) {
				showToast(
					shouldSubmitSepa
						? "Please complete all required fields and agreements before saving."
						: "Please complete all required profile fields before saving.",
					"error",
				);
				return;
			}

			const promises: Promise<unknown>[] = [];
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
			promises.push(updateMemberAsync(memberPayload));
			if (shouldSubmitSepa) {
				promises.push(updateSepaAsync(sepaForm.getValues()));
			}

			await Promise.all(promises);
			showToast("Profile saved successfully!", "success");
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error saving: ${errorMessage}`, "error");
		}
	};

	const isLoading = isLoadingMember || isLoadingSepa || isLoadingAdminRole;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	const completeness = computeProfileCompleteness({
		member: memberForm.watch(),
		linkedin: linkedinForm.watch(),
		sepa: sepaForm.watch(),
	});
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
		completeness,
		normalizedLinkedinUrl,
		isLinkedinUrlValid,
		currentRole,
		currentDepartment,
		isResearchDepartmentSelected,
		researchProjectOptions,
		researchProjectSelectValue,
	};
}
