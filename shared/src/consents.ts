import { z } from "zod";

/**
 * The three purposes the Data Privacy Notice asks consent for. Each is
 * granted or refused on its own; `partner_sharing_consent` gates the partner
 * CV export.
 */
export const DATA_PRIVACY_CONSENT_KEYS = [
	"website_profile_consent",
	"event_photos_consent",
	"partner_sharing_consent",
] as const;

export type DataPrivacyConsentKey = (typeof DATA_PRIVACY_CONSENT_KEYS)[number];

export const PRIVACY_ACKNOWLEDGEMENT_MESSAGE =
	"Confirm that you have read the Privacy Policy and Data Privacy Notice";

/**
 * Body of `PUT /api/members/:userId/consents`: one full consent decision.
 * Every field is required, so saving always records an explicit answer for
 * each purpose (an unticked box is a refusal, not "unchanged").
 *
 * `privacy_policy_agreed` records "I have read and understood the Privacy
 * Policy and Data Privacy Notice" and must be true. The three purposes stay
 * optional: the notice promises that refusing them has no consequences.
 */
export const memberConsentsSchema = z.object({
	privacy_policy_agreed: z.boolean().refine((value) => value, {
		message: PRIVACY_ACKNOWLEDGEMENT_MESSAGE,
	}),
	website_profile_consent: z.boolean(),
	event_photos_consent: z.boolean(),
	partner_sharing_consent: z.boolean(),
});

export type MemberConsentsInput = z.infer<typeof memberConsentsSchema>;

/** Response of `GET`/`PUT /api/members/:userId/consents`. */
export interface MemberConsents extends MemberConsentsInput {
	/** When the member last saved a decision; `null` until they have. */
	consents_decided_at: string | null;
}

/** True when every Data Privacy Notice purpose is granted. */
export function hasAllDataPrivacyConsents(
	consents: Pick<MemberConsentsInput, DataPrivacyConsentKey>,
): boolean {
	return DATA_PRIVACY_CONSENT_KEYS.every((key) => consents[key]);
}
