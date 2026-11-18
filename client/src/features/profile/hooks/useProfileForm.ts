import { zodResolver } from "@hookform/resolvers/zod";
import {
	hasBankDetailsInput,
	type MemberConsents,
} from "@member-manager/shared";
import { useForm } from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import { useProfileFormHydration } from "@/features/profile/hooks/useProfileFormHydration";
import {
	buildProfileMemberPayload,
	describeSaveOutcome,
	parseProfileSepaForSave,
	toSavePart,
	validateProfileBeforeSave,
} from "@/features/profile/profileFormSubmit";
import {
	computeProfileCompleteness,
	getMissingProfileFields,
	toMemberFormValues,
	toSepaFormValues,
} from "@/features/profile/profileFormUtils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMemberConsents } from "@/hooks/useMemberConsents";
import { useMemberData } from "@/hooks/useMemberData";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { useSepaData } from "@/hooks/useSepaData";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import {
	isLinkedinProfileUrl,
	normalizeLinkedinProfileUrl,
} from "@/lib/linkedin";
import { resolveDepartmentForMemberRole } from "@/lib/memberMetadata";
import { getResearchProjectSelectValue } from "@/lib/researchProjects";
import {
	type MemberSchema,
	memberSchema,
	type ProfileSepaInput,
	profileSepaSchema,
} from "@/lib/schemas";
import type { ResearchProject } from "@/types";

export interface UseProfileFormResult {
	memberForm: ReturnType<typeof useForm<MemberSchema>>;
	sepaForm: ReturnType<typeof useForm<ProfileSepaInput>>;
	// biome-ignore lint/suspicious/noExplicitAny: member is untyped API data
	memberData: any;
	isAdmin: boolean;
	isLoading: boolean;
	isUpdating: boolean;
	isLoadingResearchProjects: boolean;
	onSubmit: () => Promise<void>;
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

function createEmptyMemberForm(userId: string): MemberSchema {
	return {
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
		user_id: userId,
		batch: "",
		department: "",
		member_role: "",
		degree: "",
		school: "",
		reimbursement_slack_notifications_enabled: false,
		linkedin_profile_url: "",
		public_location: "",
	};
}

/** Profile inputs are keyed by member id + API data, not Supabase auth objects. */
export function useProfileForm(userId: string): UseProfileFormResult {
	const { showToast } = useToast();

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(userId);
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(userId);
	const { consents: memberConsents } = useMemberConsents(userId);
	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();
	const {
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: isUpdatingSepa,
	} = useSepaData(userId);

	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: createEmptyMemberForm(userId),
	});

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

	const isLoading = isLoadingMember || isLoadingSepa || isLoadingAdminRole;
	const isDirty = memberForm.formState.isDirty || sepaForm.formState.isDirty;

	useProfileFormHydration({
		userId,
		memberData,
		sepaData,
		isReady: !isLoading,
		memberForm,
		sepaForm,
	});

	const linkedinUrl = memberForm.watch("linkedin_profile_url");
	const normalizedLinkedinUrl = normalizeLinkedinProfileUrl(linkedinUrl);
	const isLinkedinUrlValid = isLinkedinProfileUrl(linkedinUrl);
	const hasSavedBankDetails = hasBankDetailsInput(sepaData ?? {});

	const onSubmit = async (): Promise<void> => {
		try {
			const validation = await validateProfileBeforeSave({
				memberForm,
				sepaForm,
				sepaData,
				hasSavedBankDetails,
			});
			if (!validation.ok) {
				showToast(validation.toastMessage, "error");
				return;
			}

			const memberValues = memberForm.getValues();
			const memberPayload = buildProfileMemberPayload(memberValues, isAdmin);
			const { sepaValues, sendsSepa } = validation;

			const [memberResult, sepaResult] = await Promise.allSettled([
				updateMemberAsync(memberPayload as Partial<MemberSchema>),
				sendsSepa
					? updateSepaAsync(parseProfileSepaForSave(sepaValues))
					: Promise.resolve(),
			]);

			if (memberResult.status === "fulfilled") {
				const saved = memberResult.value as Record<string, unknown> | undefined;
				memberForm.reset(
					saved ? toMemberFormValues(saved, userId) : memberValues,
				);
			}
			if (sendsSepa && sepaResult.status === "fulfilled") {
				const saved = sepaResult.value as Record<string, unknown> | undefined;
				sepaForm.reset(saved ? toSepaFormValues(saved) : sepaValues);
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

	useUnsavedChangesWarning(isDirty);

	const completenessInput = {
		member: memberForm.watch(),
		sepa: sepaForm.watch(),
		consentsDecided: Boolean(memberConsents?.consents_decided_at),
	};
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

	return {
		memberForm,
		sepaForm,
		memberData,
		isAdmin,
		isLoading,
		isUpdating: isUpdatingMember || isUpdatingSepa,
		isLoadingResearchProjects,
		onSubmit,
		isDirty,
		completeness: computeProfileCompleteness(completenessInput),
		missingProfileFields: getMissingProfileFields(completenessInput),
		normalizedLinkedinUrl,
		isLinkedinUrlValid,
		currentRole,
		currentDepartment,
		isResearchDepartmentSelected: effectiveProfileDepartment === "Research",
		researchProjectOptions,
		researchProjectSelectValue: getResearchProjectSelectValue(
			memberForm.watch("research_project_id"),
			researchProjectOptions,
		),
		memberConsents,
	};
}
