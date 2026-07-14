import { getAuthEmail } from "../authEmails.js";
import {
	getContractLegalEmail,
	isContractEmailConfigured,
	sendContractClarificationEmail,
	sendContractStatusChangeEmail,
} from "../contractEmails.js";
import { getSupabase } from "../supabase.js";
import { getPartnerCompanyNameFromSubmission } from "./contractRecords.js";
import { createContractDatabaseError } from "./contractRepository.js";
import { getAppBaseUrl } from "./contractSecurity.js";

type ContractLogger = {
	warn: (obj: unknown, message: string) => void;
};

export async function notifySubmitterOfClarification(args: {
	submission: Record<string, unknown>;
	message?: string | null;
	submissionUrl: string;
}): Promise<{ recipient: string | null; error: string | null }> {
	if (!isContractEmailConfigured()) {
		return {
			recipient: null,
			error:
				"Contract email sending is not configured. Set RESEND_API_KEY and CONTRACT_EMAIL_FROM.",
		};
	}
	const submitterUserId =
		typeof args.submission.submitter_user_id === "string"
			? args.submission.submitter_user_id
			: "";
	if (!submitterUserId) {
		return { recipient: null, error: "Submission submitter is missing." };
	}

	const submitterEmail = await getAuthEmail(submitterUserId);
	if (!submitterEmail) {
		return { recipient: null, error: "Submission submitter email not found." };
	}

	await sendContractClarificationEmail({
		to: submitterEmail,
		partnerCompanyName: getPartnerCompanyNameFromSubmission(args.submission),
		message: args.message,
		submissionUrl: args.submissionUrl,
	});
	return { recipient: submitterEmail, error: null };
}

export async function getMemberDisplayName(
	userId: string,
): Promise<string | null> {
	const { data } = await getSupabase()
		.from("members")
		.select("given_name, surname")
		.eq("user_id", userId)
		.maybeSingle();
	const first =
		data && typeof data.given_name === "string" ? data.given_name.trim() : "";
	const last =
		data && typeof data.surname === "string" ? data.surname.trim() : "";
	const full = `${first} ${last}`.trim();
	if (full) return full;
	return (await getAuthEmail(userId)) || null;
}

export async function recordStatusEvent(args: {
	submissionId: string;
	fromStatus: string | null;
	toStatus: string;
	changedBy: string | null;
	changedByName: string | null;
	note?: string | null;
}): Promise<void> {
	if (args.fromStatus === args.toStatus) return;
	if (args.fromStatus === "draft" && args.toStatus === "draft") return;
	const { error } = await getSupabase()
		.from("contract_status_events")
		.insert({
			submission_id: args.submissionId,
			from_status: args.fromStatus,
			to_status: args.toStatus,
			changed_by: args.changedBy,
			changed_by_name: args.changedByName,
			note: args.note ?? null,
		});
	if (error) throw createContractDatabaseError(error);
}

export async function notifyContractStatusChange(args: {
	submission: Record<string, unknown>;
	fromStatus: string | null;
	toStatus: string;
	submissionUrl: string;
	note?: string | null;
	skipCreator?: boolean;
	log: ContractLogger;
}): Promise<void> {
	if (args.fromStatus === args.toStatus) return;
	if (args.fromStatus === "draft" && args.toStatus === "draft") return;
	if (!isContractEmailConfigured()) {
		args.log.warn(
			{ fromStatus: args.fromStatus, toStatus: args.toStatus },
			"Contract status change notification skipped: email not configured",
		);
		return;
	}

	const partnerCompanyName = getPartnerCompanyNameFromSubmission(
		args.submission,
	);
	const recipients: Array<{ to: string; audience: "legal" | "creator" }> = [];
	const legalEmail = getContractLegalEmail();
	if (legalEmail) recipients.push({ to: legalEmail, audience: "legal" });
	const submitterUserId =
		typeof args.submission.submitter_user_id === "string"
			? args.submission.submitter_user_id
			: "";
	if (!args.skipCreator && submitterUserId) {
		try {
			const creatorEmail = await getAuthEmail(submitterUserId);
			if (creatorEmail && creatorEmail !== legalEmail) {
				recipients.push({ to: creatorEmail, audience: "creator" });
			}
		} catch (error) {
			args.log.warn(
				{ err: error, submitterUserId },
				"Failed to look up creator email",
			);
		}
	}

	for (const recipient of recipients) {
		try {
			await sendContractStatusChangeEmail({
				to: recipient.to,
				partnerCompanyName,
				submissionUrl: args.submissionUrl,
				fromStatus: args.fromStatus,
				toStatus: args.toStatus,
				note: args.note,
				audience: recipient.audience,
			});
		} catch (error) {
			args.log.warn(
				{ err: error, to: recipient.to },
				"Failed to send contract status-change notification",
			);
		}
	}
}

export async function recordAndNotifyTransition(args: {
	request: {
		headers: Record<string, unknown>;
		log: ContractLogger;
	};
	submissionId: string;
	fromStatus: string | null;
	toStatus: string;
	changedBy: string | null;
	changedByName: string | null;
	note?: string | null;
}): Promise<void> {
	try {
		await recordStatusEvent({
			submissionId: args.submissionId,
			fromStatus: args.fromStatus,
			toStatus: args.toStatus,
			changedBy: args.changedBy,
			changedByName: args.changedByName,
			note: args.note,
		});
	} catch (error) {
		args.request.log.warn(
			{ err: error, submissionId: args.submissionId },
			"Failed to record contract status event",
		);
	}
	try {
		const { data } = await getSupabase()
			.from("contract_submissions")
			.select("submitter_user_id, form_data")
			.eq("id", args.submissionId)
			.maybeSingle();
		await notifyContractStatusChange({
			submission: (data as Record<string, unknown>) ?? {},
			fromStatus: args.fromStatus,
			toStatus: args.toStatus,
			submissionUrl: `${getAppBaseUrl(args.request)}/contracts/submissions/${args.submissionId}`,
			note: args.note,
			log: args.request.log,
		});
	} catch (error) {
		args.request.log.warn(
			{ err: error, submissionId: args.submissionId },
			"Failed to notify contract status change",
		);
	}
}
