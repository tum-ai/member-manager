import {
	isContractEmailConfigured,
	sendContractPartnerEmail,
} from "../contractEmails.js";
import { getSupabase } from "../supabase.js";
import { decryptContractJson } from "./contractArtifactCrypto.js";
import {
	getPartnerCompanyNameFromSubmission,
	getPartnerEmailFromSubmission,
} from "./contractRecords.js";
import { generateSignatureToken, getAppBaseUrl } from "./contractSecurity.js";
import { recordAndNotifyTransition } from "./contractWorkflow.js";

export async function prepareFinalDocument(
	submissionId: string,
	current: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const versionId = current.active_document_version_id;
	if (typeof versionId !== "string") {
		throw new Error("Ready DOCX contract version is missing");
	}
	const { data: version, error: versionError } = await getSupabase()
		.from("contract_document_versions")
		.select("id, renderer_engine, artifact_status")
		.eq("id", versionId)
		.maybeSingle();
	if (versionError) throw versionError;
	if (
		version?.renderer_engine !== "docx" ||
		version.artifact_status !== "ready"
	) {
		throw new Error("Ready DOCX contract version is missing");
	}
	const { data, error } = await getSupabase()
		.from("contract_submissions")
		.update({
			final_pdf_token: current.final_pdf_token ?? generateSignatureToken(),
			final_document_version_id: version.id,
			active_document_version_id: version.id,
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
			submission?.auto_send_after_board_signed !== true ||
			submission.status !== "board_signed"
		) {
			return;
		}

		const hydratedSubmission = { ...submission };
		if (
			hydratedSubmission.renderer_engine === "docx" &&
			typeof hydratedSubmission.form_data_encrypted === "string"
		) {
			hydratedSubmission.form_data = decryptContractJson(
				hydratedSubmission.form_data_encrypted,
			);
		}
		const partnerEmail = getPartnerEmailFromSubmission(hydratedSubmission);
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

		const prepared = await prepareFinalDocument(
			args.submissionId,
			hydratedSubmission,
		);
		const partnerCompany =
			getPartnerCompanyNameFromSubmission(hydratedSubmission) || "Partner";
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
