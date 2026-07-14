import {
	isContractEmailConfigured,
	sendContractPartnerEmail,
} from "../contractEmails.js";
import { getSupabase } from "../supabase.js";
import {
	buildSignedDocumentText,
	getPartnerCompanyNameFromSubmission,
	getPartnerEmailFromSubmission,
	textFromSubmission,
} from "./contractRecords.js";
import {
	createDocumentVersion,
	fetchDocumentVersion,
} from "./contractRepository.js";
import { generateSignatureToken, getAppBaseUrl } from "./contractSecurity.js";
import { recordAndNotifyTransition } from "./contractWorkflow.js";

export async function prepareFinalDocument(
	submissionId: string,
	current: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	let baseVersion = await fetchDocumentVersion(
		current.active_document_version_id ?? current.sent_document_version_id,
	);
	if (baseVersion?.source === "final") {
		const { data, error } = await getSupabase()
			.from("contract_document_versions")
			.select("*")
			.eq("submission_id", submissionId)
			.neq("source", "final")
			.order("version_number", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (error) throw error;
		baseVersion = (data as Record<string, unknown> | null) ?? null;
	}

	const baseText =
		typeof baseVersion?.rendered_text === "string"
			? baseVersion.rendered_text
			: textFromSubmission(current);
	const finalVersion = await createDocumentVersion({
		submissionId,
		source: "final",
		text: buildSignedDocumentText(baseText, current),
		formData:
			typeof current.form_data === "object" && current.form_data !== null
				? (current.form_data as Record<string, unknown>)
				: {},
	});
	const { data, error } = await getSupabase()
		.from("contract_submissions")
		.update({
			final_pdf_token: generateSignatureToken(),
			final_document_version_id: finalVersion.id,
			active_document_version_id: finalVersion.id,
			updated_at: new Date().toISOString(),
		})
		.eq("id", submissionId)
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}

export async function completeSubmission(
	submissionId: string,
): Promise<Record<string, unknown>> {
	const nowIso = new Date().toISOString();
	const { data, error } = await getSupabase()
		.from("contract_submissions")
		.update({
			final_pdf_sent_at: nowIso,
			completed_at: nowIso,
			status: "completed",
			updated_at: nowIso,
		})
		.eq("id", submissionId)
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}

export async function maybeAutoSendAfterBoardSign(args: {
	request: {
		headers: Record<string, unknown>;
		log: { warn: (obj: unknown, message: string) => void };
	};
	submissionId: string;
}): Promise<void> {
	try {
		const { data } = await getSupabase()
			.from("contract_submissions")
			.select("*")
			.eq("id", args.submissionId)
			.maybeSingle();
		const submission = (data as Record<string, unknown> | null) ?? null;
		if (
			!submission ||
			submission.auto_send_after_board_signed !== true ||
			submission.status !== "board_signed"
		) {
			return;
		}

		const partnerEmail = getPartnerEmailFromSubmission(submission);
		if (!isContractEmailConfigured() || !partnerEmail) {
			args.request.log.warn(
				{
					submissionId: args.submissionId,
					partnerEmail: Boolean(partnerEmail),
				},
				"Auto-send after board signature skipped: email not configured or partner email missing",
			);
			return;
		}

		const prepared = await prepareFinalDocument(args.submissionId, submission);
		const partnerCompany =
			getPartnerCompanyNameFromSubmission(submission) || "Partner";
		const finalPdfUrl = `${getAppBaseUrl(args.request)}/api/contracts/final/${String(prepared.final_pdf_token)}/pdf`;
		try {
			await sendContractPartnerEmail({
				to: partnerEmail,
				partnerCompanyName: partnerCompany,
				signingUrl: finalPdfUrl,
				linkLabel: "View signed contract",
				subject: `TUM.ai contract for ${partnerCompany} - signed copy`,
				customMessage:
					"The contract has been signed by all parties. You can view and download the final signed document using the link below.",
			});
		} catch (emailError) {
			const message =
				emailError instanceof Error
					? emailError.message
					: "Failed to send final contract email";
			args.request.log.warn(
				{ err: emailError, submissionId: args.submissionId },
				"Auto-send after board signature failed to send final email",
			);
			await getSupabase()
				.from("contract_submissions")
				.update({
					partner_email_recipient: partnerEmail,
					partner_email_error: message,
					updated_at: new Date().toISOString(),
				})
				.eq("id", args.submissionId);
			return;
		}

		await completeSubmission(args.submissionId);
		await getSupabase()
			.from("contract_submissions")
			.update({
				partner_email_sent_at: new Date().toISOString(),
				partner_email_recipient: partnerEmail,
				partner_email_error: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", args.submissionId);
		await recordAndNotifyTransition({
			request: args.request,
			submissionId: args.submissionId,
			fromStatus: "board_signed",
			toStatus: "completed",
			changedBy: null,
			changedByName: "Auto-send",
		});
	} catch (error) {
		args.request.log.warn(
			{ err: error, submissionId: args.submissionId },
			"Auto-send after board signature failed",
		);
	}
}
