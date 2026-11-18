import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
	applyProfileFieldSuggestions,
	toProfileFormValues,
} from "@/features/profile/profileFormUtils";
import type { ProfileAuthPrefill } from "@/features/profile/profileTypes";
import type { MemberSchema, ProfileSepaInput } from "@/lib/schemas";

/**
 * When member/sepa queries return new data (initial load, refetch on focus,
 * after save), merge it into the forms without overwriting dirty fields.
 */
export function useProfileFormHydration({
	userId,
	memberData,
	sepaData,
	isReady,
	memberForm,
	sepaForm,
	authMetadata,
}: {
	userId: string;
	// biome-ignore lint/suspicious/noExplicitAny: API row
	memberData: any;
	// biome-ignore lint/suspicious/noExplicitAny: API row
	sepaData: any;
	isReady: boolean;
	memberForm: UseFormReturn<MemberSchema>;
	sepaForm: UseFormReturn<ProfileSepaInput>;
	authMetadata: ProfileAuthPrefill;
}): void {
	useEffect(() => {
		if (!isReady) return;

		const baseline = toProfileFormValues(memberData, sepaData, userId);
		memberForm.reset(baseline.member, { keepDirtyValues: true });
		sepaForm.reset(baseline.sepa, { keepDirtyValues: true });
	}, [isReady, memberData, sepaData, userId, memberForm, sepaForm]);

	useEffect(() => {
		if (!isReady) return;
		applyProfileFieldSuggestions(memberForm, memberData, authMetadata);
	}, [isReady, memberData, memberForm, authMetadata]);
}
