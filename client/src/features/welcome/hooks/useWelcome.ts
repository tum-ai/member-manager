import type { MemberConsentsInput } from "@member-manager/shared";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/contexts/ToastContext";
import { useMemberConsents } from "@/hooks/useMemberConsents";
import { useMemberData } from "@/hooks/useMemberData";
import { markWelcomeSkipped } from "@/lib/postLoginRedirect";

export type ConsentField = keyof MemberConsentsInput;

const NOTHING_GRANTED: MemberConsentsInput = {
	privacy_policy_agreed: false,
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: false,
};

function pickDecision(source: MemberConsentsInput): MemberConsentsInput {
	return {
		privacy_policy_agreed: source.privacy_policy_agreed,
		website_profile_consent: source.website_profile_consent,
		event_photos_consent: source.event_photos_consent,
		partner_sharing_consent: source.partner_sharing_consent,
	};
}

/**
 * State for the /welcome page: the member's consent choices (edited locally,
 * saved in one request) plus navigation out of the page.
 */
export function useWelcome(userId: string) {
	const navigate = useNavigate();
	const location = useLocation();
	const { showToast } = useToast();
	const { member, isLoading: isMemberLoading } = useMemberData(userId);
	const {
		consents,
		isLoading: isConsentsLoading,
		error: consentsError,
		saveConsentsAsync,
		isSaving,
	} = useMemberConsents(userId);

	const [draft, setDraft] = useState<MemberConsentsInput>(NOTHING_GRANTED);
	const [isDirty, setIsDirty] = useState(false);

	// Start from what is stored (nothing is pre-ticked for an undecided
	// member, whose stored values are all false), but never overwrite choices
	// the member is in the middle of making.
	useEffect(() => {
		if (consents && !isDirty) {
			setDraft(pickDecision(consents));
		}
	}, [consents, isDirty]);

	const setConsent = (field: ConsentField, value: boolean): void => {
		setDraft((current) => ({ ...current, [field]: value }));
		setIsDirty(true);
	};

	const agreeToAll = (): void => {
		setDraft({
			privacy_policy_agreed: true,
			website_profile_consent: true,
			event_photos_consent: true,
			partner_sharing_consent: true,
		});
		setIsDirty(true);
	};

	const saveConsents = async (): Promise<void> => {
		try {
			await saveConsentsAsync(draft);
			setIsDirty(false);
			showToast("Your consent choices are saved.", "success");
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Could not save your consent choices.",
				"error",
			);
		}
	};

	// WelcomeRedirect passes the page it interrupted; go back there.
	const interruptedPath = (location.state as { from?: unknown } | null)?.from;
	const skipForNow = (): void => {
		markWelcomeSkipped();
		navigate(
			typeof interruptedPath === "string" && interruptedPath.startsWith("/")
				? interruptedPath
				: "/",
		);
	};

	const continueToProfile = (): void => {
		navigate("/");
	};

	// A first Slack login whose email doesn't match the imported member record
	// creates a fresh, nameless account (`handle_new_user`). The member can
	// still decide here; an admin merges the accounts afterwards.
	const needsAccountLink =
		!isMemberLoading &&
		Boolean(member) &&
		!String(member?.given_name ?? "").trim();

	return {
		draft,
		setConsent,
		agreeToAll,
		saveConsents,
		isSaving,
		isDirty,
		isLoading: isMemberLoading || isConsentsLoading,
		consentsError,
		isDecided: Boolean(consents?.consents_decided_at),
		needsAccountLink,
		skipForNow,
		continueToProfile,
	};
}
