import {
	type MemberConsents,
	memberConsentsSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureOwnerOrAdmin } from "../lib/auth.js";
import { DatabaseError, ForbiddenError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const CONSENT_COLUMNS =
	"privacy_policy_agreed, website_profile_consent, event_photos_consent, partner_sharing_consent, consents_decided_at";

const consentParamsSchema = z.object({
	userId: z.string().trim().min(1),
});

/** A member without a `member_agreements` row has granted nothing and decided nothing. */
const UNDECIDED_CONSENTS: MemberConsents = {
	privacy_policy_agreed: false,
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: false,
	consents_decided_at: null,
};

function toMemberConsents(
	row: Record<string, unknown> | null | undefined,
): MemberConsents {
	if (!row) return UNDECIDED_CONSENTS;
	return {
		privacy_policy_agreed: Boolean(row.privacy_policy_agreed),
		website_profile_consent: Boolean(row.website_profile_consent),
		event_photos_consent: Boolean(row.event_photos_consent),
		partner_sharing_consent: Boolean(row.partner_sharing_consent),
		consents_decided_at:
			typeof row.consents_decided_at === "string"
				? row.consents_decided_at
				: null,
	};
}

/**
 * Per-purpose consent (Privacy Policy + the three Data Privacy Notice
 * purposes), used by the /welcome page. Stored in `member_agreements`; the DB
 * trigger `sync_member_agreement_consents` keeps the legacy
 * `data_privacy_notice_agreed` summary in step.
 */
export async function consentRoutes(server: FastifyInstance) {
	server.get<{ Params: { userId: string } }>(
		"/members/:userId/consents",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = consentParamsSchema.parse(request.params);
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own consents",
			);

			const { data, error } = await getSupabase()
				.from("member_agreements")
				.select(CONSENT_COLUMNS)
				.eq("user_id", userId)
				.maybeSingle();
			if (error) {
				request.log.error({ err: error, userId }, "Failed to read consents");
				throw new DatabaseError();
			}
			return toMemberConsents(data as Record<string, unknown> | null);
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/members/:userId/consents",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = consentParamsSchema.parse(request.params);
			const user = (request as AuthenticatedRequest).user;
			// Consent is personal: unlike most profile data, an admin can't give
			// or withdraw it on a member's behalf.
			if (user.id !== userId) {
				throw new ForbiddenError("You can only change your own consents");
			}

			const body = memberConsentsSchema.parse(request.body);
			const now = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("member_agreements")
				.upsert(
					{
						user_id: userId,
						...body,
						consents_decided_at: now,
						updated_at: now,
					},
					{ onConflict: "user_id" },
				)
				.select(CONSENT_COLUMNS)
				.single();
			if (error) {
				request.log.error({ err: error, userId }, "Failed to save consents");
				throw new DatabaseError();
			}
			return toMemberConsents(data as Record<string, unknown>);
		},
	);
}
