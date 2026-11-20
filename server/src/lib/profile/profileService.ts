import {
	BANK_DETAILS_REMOVAL_MESSAGE,
	computeProfileCompleteness,
	hasBankDetailsInput,
	PROFILE_VERSION_CONFLICT_CODE,
	type ProfileResponse,
	type ProfileUpdate,
} from "@member-manager/shared";
import type { FastifyBaseLogger } from "fastify";
import { getAuthProfiles } from "../authEmails.js";
import {
	DatabaseError,
	PreconditionFailedError,
	ValidationError,
} from "../errors.js";
import {
	decryptRecordSafely,
	encryptRecord,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../sensitiveData.js";
import { resolveMemberUpdate } from "./memberUpdatePolicy.js";
import {
	loadStoredProfile,
	ProfileVersionConflictError,
	type StoredProfile,
	saveStoredProfile,
} from "./profileRepository.js";

type Row = Record<string, unknown>;

/** A member who has no row yet sees an empty profile at version 0. */
const NEW_PROFILE_VERSION = 0;

function decryptingLogger(
	log: FastifyBaseLogger,
	userId: string,
	label: string,
) {
	return ({ field, error }: { field: string; error: Error }) => {
		log.warn(
			{ err: error, userId, field },
			`Failed to decrypt ${label} field; returning blank value`,
		);
	};
}

async function loadAuthProfile(userId: string, log: FastifyBaseLogger) {
	try {
		return (await getAuthProfiles([userId])).get(userId);
	} catch (error) {
		log.error({ err: error }, "Failed to fetch auth profile");
		throw new DatabaseError();
	}
}

function toResponse(
	userId: string,
	stored: StoredProfile,
	authProfile: { email?: string; avatar_url?: string } | undefined,
	log: FastifyBaseLogger,
): ProfileResponse {
	const member = stored.member
		? decryptRecordSafely(
				stored.member,
				SENSITIVE_MEMBER_FIELDS,
				decryptingLogger(log, userId, "member"),
			)
		: ({ user_id: userId } as Row);
	const bank = stored.sepa
		? decryptRecordSafely(
				stored.sepa,
				SENSITIVE_SEPA_FIELDS,
				decryptingLogger(log, userId, "SEPA"),
			)
		: ({} as Row);
	const agreements = stored.agreements ?? {};

	const sepa = {
		iban: String(bank.iban ?? ""),
		bic: String(bank.bic ?? ""),
		bank_name: String(bank.bank_name ?? ""),
		mandate_agreed: Boolean(
			agreements.sepa_mandate_agreed ?? bank.mandate_agreed,
		),
		privacy_agreed: Boolean(
			agreements.privacy_policy_agreed ?? bank.privacy_agreed,
		),
		data_privacy_notice_agreed: Boolean(agreements.data_privacy_notice_agreed),
	};

	return {
		version: Number(member.version ?? NEW_PROFILE_VERSION),
		member: {
			...member,
			user_id: userId,
			email: authProfile?.email ?? "",
			// Slack profile picture from the auth metadata.
			avatar_url: authProfile?.avatar_url ?? "",
		},
		sepa,
		completeness: computeProfileCompleteness({
			member,
			sepa,
			consentsDecided: Boolean(agreements.consents_decided_at),
		}),
	};
}

export async function loadProfile(
	userId: string,
	log: FastifyBaseLogger,
): Promise<ProfileResponse> {
	let stored: StoredProfile;
	try {
		stored = await loadStoredProfile(userId);
	} catch (error) {
		log.error({ err: error, userId }, "Failed to load profile");
		throw error instanceof DatabaseError ? error : new DatabaseError();
	}
	const authProfile = await loadAuthProfile(userId, log);
	return toResponse(userId, stored, authProfile, log);
}

export interface SaveProfileRequest {
	userId: string;
	isAdmin: boolean;
	update: ProfileUpdate;
}

/**
 * Saves the whole profile atomically. Throws a `PreconditionFailedError` (412)
 * carrying the current profile when `update.version` is stale, and a
 * `ValidationError` for rule violations (clearing saved bank details,
 * missing department).
 */
export async function saveProfile(
	{ userId, isAdmin, update }: SaveProfileRequest,
	log: FastifyBaseLogger,
): Promise<ProfileResponse> {
	let stored: StoredProfile;
	try {
		stored = await loadStoredProfile(userId);
	} catch (error) {
		log.error({ err: error, userId }, "Failed to load profile before save");
		throw error instanceof DatabaseError ? error : new DatabaseError();
	}

	const memberPatch = encryptRecord(
		resolveMemberUpdate(update.member, { isAdmin, existing: stored.member }),
		SENSITIVE_MEMBER_FIELDS,
	);

	const { sepa } = update;
	const includesBankDetails = hasBankDetailsInput(sepa);
	// Presence check only: stored values are ciphertext and never decrypted here.
	if (!includesBankDetails && stored.sepa && hasBankDetailsInput(stored.sepa)) {
		throw new ValidationError(BANK_DETAILS_REMOVAL_MESSAGE);
	}

	const agreementsChanged =
		Boolean(sepa.mandate_agreed) !==
			Boolean(stored.agreements?.sepa_mandate_agreed) ||
		Boolean(sepa.privacy_agreed) !==
			Boolean(stored.agreements?.privacy_policy_agreed) ||
		(sepa.data_privacy_notice_agreed !== undefined &&
			sepa.data_privacy_notice_agreed !==
				Boolean(stored.agreements?.data_privacy_notice_agreed));

	try {
		await saveStoredProfile({
			userId,
			expectedVersion: update.version,
			member: memberPatch,
			sepa: includesBankDetails
				? encryptRecord(
						{
							iban: sepa.iban,
							bic: sepa.bic,
							bank_name: sepa.bank_name,
							mandate_agreed: sepa.mandate_agreed,
							privacy_agreed: sepa.privacy_agreed,
						},
						SENSITIVE_SEPA_FIELDS,
					)
				: null,
			agreements:
				includesBankDetails || agreementsChanged
					? {
							sepa_mandate_agreed: sepa.mandate_agreed,
							privacy_policy_agreed: sepa.privacy_agreed,
							// Writing the summary grants or revokes all three consent
							// purposes, so it is only sent when the caller answered.
							...(sepa.data_privacy_notice_agreed === undefined
								? {}
								: {
										data_privacy_notice_agreed: sepa.data_privacy_notice_agreed,
									}),
						}
					: null,
		});
	} catch (error) {
		if (error instanceof ProfileVersionConflictError) {
			throw new PreconditionFailedError(
				"Your profile was changed elsewhere. Reload to see the latest version.",
				{
					code: PROFILE_VERSION_CONFLICT_CODE,
					current: await loadProfile(userId, log),
				},
			);
		}
		log.error({ err: error, userId }, "Failed to save profile");
		throw new DatabaseError();
	}

	return loadProfile(userId, log);
}
