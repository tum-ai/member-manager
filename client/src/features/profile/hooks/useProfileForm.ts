import {
	BANK_DETAILS_REMOVAL_MESSAGE,
	hasBankDetailsInput,
	PROFILE_VERSION_CONFLICT_CODE,
	type ProfileResponse,
} from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
	type FieldErrors,
	type UseFormReturn,
	useWatch,
} from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import { useProfileDerived } from "@/features/profile/hooks/useProfileDerived";
import {
	profileQueryKey,
	useProfileQuery,
} from "@/features/profile/hooks/useProfileQuery";
import { useSaveProfile } from "@/features/profile/hooks/useSaveProfile";
import {
	EMPTY_PROFILE_FORM_VALUES,
	getProfileSuggestions,
	getSuggestedFields,
	type ProfileFormValues,
	profileFormResolver,
	type SuggestedField,
	toFormValues,
	toUpdatePayload,
} from "@/features/profile/profileFormModel";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMemberConsents } from "@/hooks/useMemberConsents";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { useServerBackedForm } from "@/hooks/useServerBackedForm";
import { isApiError } from "@/lib/apiError";

const REQUIRED_FIELDS_MESSAGE =
	"Please complete all required profile fields before saving.";
const BANK_GROUP_MESSAGE =
	"Please complete all required fields and agreements before saving.";
const BANK_GROUP_FIELDS = [
	"iban",
	"bic",
	"bank_name",
	"mandate_agreed",
	"privacy_agreed",
] as const;

export interface ProfileConflict {
	/** The profile as it is stored now. */
	current: ProfileResponse;
}

export interface UseProfileFormResult {
	form: UseFormReturn<ProfileFormValues>;
	profile: ProfileResponse | undefined;
	loadError: Error | null;
	isAdmin: boolean;
	isLoading: boolean;
	isUpdating: boolean;
	isLoadingResearchProjects: boolean;
	onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
	completeness: number;
	missingProfileFields: string[];
	suggestedFields: SuggestedField[];
	conflict: ProfileConflict | null;
	/** Drop the local edits and show what is stored now. */
	reloadLatest: () => void;
	/** Keep the local edits on top of what is stored now, then save again. */
	keepMyChanges: () => void;
	currentRole: string;
	currentDepartment: string;
	isResearchDepartmentSelected: boolean;
	researchProjectOptions: ReturnType<
		typeof useProfileDerived
	>["researchProjectOptions"];
	researchProjectSelectValue: string;
	memberConsents: ReturnType<typeof useMemberConsents>["consents"];
}

export function useProfileForm(user: User): UseProfileFormResult {
	const userId = user.id;
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const profileQuery = useProfileQuery(userId);
	const profile = profileQuery.data;
	const saveProfile = useSaveProfile(userId);
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(userId);
	const { consents: memberConsents } = useMemberConsents(userId);
	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();
	const [conflict, setConflict] = useState<ProfileConflict | null>(null);

	const suggestions = useMemo(() => getProfileSuggestions(user), [user]);
	const serverValues = useMemo(
		() => (profile ? toFormValues(profile, suggestions) : undefined),
		[profile, suggestions],
	);
	const suggestedFields = useMemo(
		() => getSuggestedFields(profile, suggestions),
		[profile, suggestions],
	);

	// A refetch (window focus, invalidation) or a re-created auth user never
	// overwrites what the member has typed (#397).
	const { form, markSaved, resetTo } = useServerBackedForm<ProfileFormValues>({
		resolver: profileFormResolver,
		defaultValues: EMPTY_PROFILE_FORM_VALUES,
		serverValues,
	});

	// Once bank details are stored they can be edited but not cleared; the
	// server enforces the same rule.
	const hasSavedBankDetails = hasBankDetailsInput(profile?.sepa ?? {});

	const save = async (values: ProfileFormValues): Promise<void> => {
		if (!profile) return;

		if (hasSavedBankDetails && !hasBankDetailsInput(values)) {
			form.setError("iban", {
				type: "manual",
				message: BANK_DETAILS_REMOVAL_MESSAGE,
			});
			showToast(BANK_DETAILS_REMOVAL_MESSAGE, "error");
			return;
		}

		try {
			await saveProfile.mutateAsync(
				toUpdatePayload(values, { version: profile.version, isAdmin }),
			);
			markSaved();
			setConflict(null);
			showToast("Profile saved successfully!", "success");
		} catch (error: unknown) {
			if (
				isApiError(error) &&
				error.status === 412 &&
				error.body?.code === PROFILE_VERSION_CONFLICT_CODE
			) {
				setConflict({ current: error.body.current as ProfileResponse });
				return;
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			showToast(`Error saving: ${message}`, "error");
		}
	};

	const onInvalid = (errors: FieldErrors<ProfileFormValues>): void => {
		const bankInvalid = BANK_GROUP_FIELDS.some((field) => errors[field]);
		showToast(
			bankInvalid ? BANK_GROUP_MESSAGE : REQUIRED_FIELDS_MESSAGE,
			"error",
		);
	};

	const reloadLatest = useCallback(() => {
		if (!conflict) return;
		resetTo(toFormValues(conflict.current, suggestions));
		queryClient.setQueryData(profileQueryKey(userId), conflict.current);
		setConflict(null);
	}, [conflict, resetTo, queryClient, suggestions, userId]);

	const keepMyChanges = useCallback(() => {
		if (!conflict) return;
		// The new snapshot carries the new version; keepDirtyValues leaves the
		// member's edits in place and refreshes the fields they did not touch.
		queryClient.setQueryData(profileQueryKey(userId), conflict.current);
		setConflict(null);
	}, [conflict, queryClient, userId]);

	const values = useWatch({ control: form.control });
	const derived = useProfileDerived({
		role: values.member_role ?? "",
		department: values.department ?? "",
		researchProjectId: values.research_project_id,
		researchProjects,
	});

	return {
		form,
		profile,
		loadError: profileQuery.error,
		isAdmin,
		isLoading: profileQuery.isLoading || isLoadingAdminRole,
		isUpdating: saveProfile.isPending,
		isLoadingResearchProjects,
		onSubmit: form.handleSubmit(save, onInvalid),
		completeness: profile?.completeness.percent ?? 0,
		missingProfileFields: profile?.completeness.missing ?? [],
		suggestedFields,
		conflict,
		reloadLatest,
		keepMyChanges,
		memberConsents,
		...derived,
	};
}
