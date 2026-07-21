import { sepaSchema, updateSepaSchema } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { ensureOwnerOrAdmin } from "../lib/auth.js";
import {
	DatabaseError,
	ForbiddenError,
	isNotFoundError,
	NotFoundError,
} from "../lib/errors.js";
import {
	decryptRecordSafely,
	encryptRecord,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

type SepaAgreementInput = {
	mandate_agreed: boolean;
	privacy_agreed: boolean;
	data_privacy_notice_agreed: boolean;
};

function buildAgreementRecord(
	userId: string,
	body: SepaAgreementInput,
): Record<string, unknown> {
	return {
		user_id: userId,
		sepa_mandate_agreed: body.mandate_agreed,
		privacy_policy_agreed: body.privacy_agreed,
		data_privacy_notice_agreed: body.data_privacy_notice_agreed,
		updated_at: new Date().toISOString(),
	};
}

async function upsertAgreementRecord(
	userId: string,
	body: SepaAgreementInput,
): Promise<void> {
	const { error } = await getSupabase()
		.from("member_agreements")
		.upsert(buildAgreementRecord(userId, body), { onConflict: "user_id" });

	if (error) {
		throw error;
	}
}

function mergeSepaAndAgreements(
	sepa: Record<string, unknown>,
	agreements?: Record<string, unknown> | null,
): Record<string, unknown> {
	return {
		...sepa,
		mandate_agreed:
			agreements?.sepa_mandate_agreed ?? Boolean(sepa.mandate_agreed),
		privacy_agreed:
			agreements?.privacy_policy_agreed ?? Boolean(sepa.privacy_agreed),
		data_privacy_notice_agreed: Boolean(agreements?.data_privacy_notice_agreed),
	};
}

export async function sepaRoutes(server: FastifyInstance) {
	server.post(
		"/sepa",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const body = sepaSchema.parse(request.body);
			const user = (request as AuthenticatedRequest).user;

			// Verify ownership
			if (body.user_id !== user.id) {
				throw new ForbiddenError("User ID mismatch");
			}

			const encryptedBody = encryptRecord(
				{
					user_id: body.user_id,
					iban: body.iban,
					bic: body.bic,
					bank_name: body.bank_name,
					// Keep legacy columns populated while agreements live in
					// member_agreements.
					mandate_agreed: body.mandate_agreed,
					privacy_agreed: body.privacy_agreed,
				},
				SENSITIVE_SEPA_FIELDS,
			);
			const { error } = await getSupabase()
				.from("sepa")
				.insert([encryptedBody]);

			if (error) {
				request.log.error({ err: error }, "Failed to insert SEPA data");
				throw new DatabaseError();
			}

			try {
				await upsertAgreementRecord(user.id, body);
			} catch (agreementError) {
				request.log.error(
					{ err: agreementError },
					"Failed to upsert member agreement data",
				);
				throw new DatabaseError();
			}

			return { message: "SEPA info added successfully" };
		},
	);

	server.get<{ Params: { userId: string } }>(
		"/sepa/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own SEPA data",
			);

			const [{ data, error }, { data: agreements, error: agreementError }] =
				await Promise.all([
					getSupabase().from("sepa").select("*").eq("user_id", userId).single(),
					getSupabase()
						.from("member_agreements")
						.select("*")
						.eq("user_id", userId)
						.maybeSingle(),
				]);

			if (agreementError && !isNotFoundError(agreementError)) {
				request.log.error(
					{ err: agreementError },
					"Failed to fetch member agreement data",
				);
				throw new DatabaseError();
			}

			if (isNotFoundError(error)) {
				throw new NotFoundError("SEPA data not found");
			}
			if (error) {
				request.log.error({ err: error }, "Failed to fetch SEPA data");
				throw new DatabaseError();
			}

			const decryptedSepa = decryptRecordSafely(
				data,
				SENSITIVE_SEPA_FIELDS,
				({ field, error }) => {
					request.log.warn(
						{ err: error, userId, field },
						"Failed to decrypt SEPA field; returning blank value",
					);
				},
			);

			return mergeSepaAndAgreements(decryptedSepa, agreements);
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/sepa/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only update your own SEPA data",
			);

			const body = updateSepaSchema.parse(request.body);

			const encryptedBody = encryptRecord(
				{
					iban: body.iban,
					bic: body.bic,
					bank_name: body.bank_name,
					// Keep legacy columns populated while agreements live in
					// member_agreements.
					mandate_agreed: body.mandate_agreed,
					privacy_agreed: body.privacy_agreed,
				},
				SENSITIVE_SEPA_FIELDS,
			);
			const { data, error } = await getSupabase()
				.from("sepa")
				.upsert(
					{ ...encryptedBody, user_id: userId },
					{ onConflict: "user_id" },
				)
				.select()
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("SEPA data not found");
			}
			if (error) {
				request.log.error({ err: error }, "Failed to fetch SEPA data");
				throw new DatabaseError();
			}

			try {
				await upsertAgreementRecord(userId, body);
			} catch (agreementError) {
				request.log.error(
					{ err: agreementError },
					"Failed to upsert member agreement data",
				);
				throw new DatabaseError();
			}

			const decryptedSepa = decryptRecordSafely(
				data,
				SENSITIVE_SEPA_FIELDS,
				({ field, error }) => {
					request.log.warn(
						{ err: error, userId, field },
						"Failed to decrypt SEPA field; returning blank value",
					);
				},
			);

			return mergeSepaAndAgreements(decryptedSepa, {
				sepa_mandate_agreed: body.mandate_agreed,
				privacy_policy_agreed: body.privacy_agreed,
				data_privacy_notice_agreed: body.data_privacy_notice_agreed,
			});
		},
	);
}
