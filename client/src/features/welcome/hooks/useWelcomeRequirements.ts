import { isActiveMember } from "@member-manager/shared";
import { useMemberConsents } from "@/hooks/useMemberConsents";
import { useCurrentMemberCv } from "@/hooks/useMemberCv";
import { useMemberData } from "@/hooks/useMemberData";

export type WelcomeStatus = "loading" | "unknown" | "incomplete" | "complete";

export interface WelcomeRequirements {
	/**
	 * `unknown` means a request failed: the app stays usable rather than
	 * locking the member onto /welcome because of an outage.
	 */
	status: WelcomeStatus;
	needsConsentDecision: boolean;
	needsCv: boolean;
}

/**
 * What a member still has to do on /welcome before using the app: save a
 * consent decision (granting or refusing each purpose both count) and, for
 * active members, have a current CV. Alumni only owe the consent decision.
 */
export function useWelcomeRequirements(userId: string): WelcomeRequirements {
	const consentsQuery = useMemberConsents(userId);
	const cvQuery = useCurrentMemberCv(userId);
	const memberQuery = useMemberData(userId);

	if (consentsQuery.error || cvQuery.error || memberQuery.error) {
		return { status: "unknown", needsConsentDecision: false, needsCv: false };
	}
	if (!consentsQuery.consents || !cvQuery.data || !memberQuery.member) {
		return { status: "loading", needsConsentDecision: false, needsCv: false };
	}

	const needsConsentDecision =
		consentsQuery.consents.consents_decided_at === null;
	const needsCv =
		isActiveMember(memberQuery.member) && cvQuery.data.cv === null;

	return {
		status: needsConsentDecision || needsCv ? "incomplete" : "complete",
		needsConsentDecision,
		needsCv,
	};
}
