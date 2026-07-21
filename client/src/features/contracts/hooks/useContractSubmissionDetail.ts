import type { ContractReviewStatus } from "@member-manager/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { downloadContractSubmissionPdf } from "@/features/contracts/contractApi";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { useCurrentUserIsAdmin } from "@/hooks/useCurrentUserIsAdmin";
import { useToolAccess } from "@/hooks/useToolAccess";
import {
	useBoardSignContractSubmission,
	useContractStatusEvents,
	useContractSubmission,
	useContractSubmissionComments,
	useContractSubmissionPreview,
	useCreateContractSubmissionComment,
	useFinalizeContractSubmission,
	useUpdateContractSubmission,
} from "./useContractSubmissions";

const APPROVABLE_STATUSES = [
	"submitted",
	"legal_review",
	"in_review",
	"inquiry",
];

const CLARIFICATION_CLOSED_STATUSES = [
	"approved",
	"sent_to_partner",
	"partner_signed",
	"board_signed",
	"signed",
	"completed",
];

type PartnerSendMethod = "link" | "email" | "opensign";

export function useContractSubmissionDetail(): ContractSubmissionDetailViewModel {
	const { id } = useParams<{ id: string }>();
	const submissionQuery = useContractSubmission(id);
	const updateMutation = useUpdateContractSubmission(id ?? "");
	const boardSignMutation = useBoardSignContractSubmission(id ?? "");
	const finalizeMutation = useFinalizeContractSubmission(id ?? "");
	const commentsQuery = useContractSubmissionComments(id);
	const createCommentMutation = useCreateContractSubmissionComment(id ?? "");
	const statusEventsQuery = useContractStatusEvents(id);

	const [editedText, setEditedText] = useState("");
	const [notes, setNotes] = useState("");
	const [clarificationMessage, setClarificationMessage] = useState("");
	const [rejectReason, setRejectReason] = useState("");
	const [internalComment, setInternalComment] = useState("");
	const [boardSignatureData, setBoardSignatureData] = useState<string | null>(
		null,
	);
	const [boardSignerName, setBoardSignerName] = useState("");
	const [partnerEmailSubject, setPartnerEmailSubject] = useState("");
	const [partnerEmailMessage, setPartnerEmailMessage] = useState("");
	const [downloadError, setDownloadError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [pendingResendMethod, setPendingResendMethod] =
		useState<PartnerSendMethod | null>(null);
	const { currentUserId, isAdmin } = useCurrentUserIsAdmin();
	const { permissions, isBoardMember } = useToolAccess();
	const isContractsAdmin = isAdmin || permissions.includes("contracts.admin");
	const previewQuery = useContractSubmissionPreview(
		isContractsAdmin ? id : undefined,
		editedText,
	);

	useEffect(() => {
		const data = submissionQuery.data;
		if (data) {
			setEditedText(
				data.admin_edited_text ?? data.generated_contract_text ?? "",
			);
			setNotes(data.notes ?? "");
			setClarificationMessage(data.feedback_message ?? "");
			const partnerCompany =
				typeof data.form_data.partner_company_name === "string"
					? data.form_data.partner_company_name
					: "your team";
			setPartnerEmailSubject(`TUM.ai contract for ${partnerCompany}`);
			setPartnerEmailMessage(
				"Please review and sign the contract using the secure link below.",
			);
		}
	}, [submissionQuery.data]);

	const submission = submissionQuery.data;
	const comments = commentsQuery.data ?? [];
	const statusEvents = statusEventsQuery.data ?? [];
	const busy =
		updateMutation.isPending ||
		boardSignMutation.isPending ||
		finalizeMutation.isPending ||
		createCommentMutation.isPending;
	const actionError =
		updateMutation.error ??
		boardSignMutation.error ??
		finalizeMutation.error ??
		createCommentMutation.error;
	const hasLegacyComment = Boolean(
		submission?.partner_comment && comments.length === 0,
	);
	const canEditDraft = Boolean(
		submission?.status === "draft" &&
			(submission.submitter_user_id === currentUserId || isAdmin),
	);
	// Sending requires explicit approval. A sent contract can be sent through a
	// different channel after explicit confirmation.
	const canSendToPartner =
		submission?.status === "approved" ||
		submission?.status === "partner_comments" ||
		submission?.status === "sent_to_partner";
	const canApprove = submission
		? APPROVABLE_STATUSES.includes(submission.status)
		: false;
	// Nr.7: clarification is closed once approved (or further along).
	const canRequestClarification = submission
		? !CLARIFICATION_CLOSED_STATUSES.includes(submission.status)
		: false;
	const signUrl = submission?.signature_token
		? `${window.location.origin}/contracts/sign/${submission.signature_token}`
		: null;
	const finalPdfUrl = submission?.final_pdf_token
		? `${window.location.origin}/api/contracts/final/${submission.final_pdf_token}/pdf`
		: null;
	const boardSignUrl = submission?.board_signature_token
		? `${window.location.origin}/contracts/board-sign/${submission.board_signature_token}`
		: null;

	async function downloadPdf(): Promise<void> {
		if (!id) return;
		setDownloadError(null);
		setDownloading(true);
		try {
			await downloadContractSubmissionPdf(id);
		} catch (error) {
			setDownloadError(
				error instanceof Error ? error.message : "Download failed",
			);
		} finally {
			setDownloading(false);
		}
	}

	function sendToPartner(method: PartnerSendMethod): void {
		const common = {
			admin_edited_text: editedText,
			notes,
		};
		if (method === "email") {
			updateMutation.mutate({
				...common,
				send_partner_email: true,
				partner_email_subject: partnerEmailSubject,
				partner_email_message: partnerEmailMessage,
			});
			return;
		}
		if (method === "opensign") {
			updateMutation.mutate({ ...common, send_opensign: true });
			return;
		}
		updateMutation.mutate({ ...common, send_to_partner: true });
	}

	function requestPartnerSend(method: PartnerSendMethod): void {
		if (submission?.status === "sent_to_partner") {
			setPendingResendMethod(method);
			return;
		}
		sendToPartner(method);
	}

	return {
		id,
		submission,
		submissionLoading: submissionQuery.isLoading,
		submissionError: submissionQuery.error,
		title: submission
			? `Submission ${submission.id.slice(0, 8)}…`
			: "Submission",
		editedText,
		notes,
		clarificationMessage,
		rejectReason,
		internalComment,
		boardSignatureData,
		boardSignerName,
		partnerEmailSubject,
		partnerEmailMessage,
		downloadError,
		downloading,
		isContractsAdmin,
		isBoardMember,
		previewPages: previewQuery.data?.pages,
		previewLoading: previewQuery.isLoading || previewQuery.isFetching,
		busy,
		actionError,
		comments,
		commentsLoading: commentsQuery.isLoading,
		commentsError: commentsQuery.error,
		hasLegacyComment,
		statusEvents,
		statusEventsLoading: statusEventsQuery.isLoading,
		formEntries: Object.entries(submission?.form_data ?? {}),
		canEditDraft,
		canSendToPartner,
		canApprove,
		canRequestClarification,
		signUrl,
		finalPdfUrl,
		boardSignUrl,
		resendConfirmationOpen: pendingResendMethod !== null,
		setEditedText,
		setNotes,
		setClarificationMessage,
		setRejectReason,
		setInternalComment,
		setBoardSignatureData,
		setBoardSignerName,
		setPartnerEmailSubject,
		setPartnerEmailMessage,
		setManualStatus: (status: ContractReviewStatus) =>
			updateMutation.mutate({
				status,
				manual_status_change: true,
			}),
		setAutoSendAfterBoardSigned: (enabled: boolean) =>
			updateMutation.mutate({ auto_send_after_board_signed: enabled }),
		confirmResend: () => {
			if (pendingResendMethod) {
				sendToPartner(pendingResendMethod);
			}
			setPendingResendMethod(null);
		},
		cancelResend: () => setPendingResendMethod(null),
		saveChanges: () =>
			updateMutation.mutate({
				admin_edited_text: editedText,
				notes,
			}),
		downloadPdf,
		sendToPartner: () => requestPartnerSend("link"),
		sendEmailToPartner: () => requestPartnerSend("email"),
		sendWithOpenSign: () => requestPartnerSend("opensign"),
		approve: () =>
			updateMutation.mutate({
				status: "approved",
				notes,
			}),
		requestClarification: () =>
			updateMutation.mutate({
				status: "inquiry",
				notes,
				feedback_message: clarificationMessage.trim() || null,
			}),
		reject: () =>
			updateMutation.mutate({
				status: "rejected",
				notes,
				rejection_reason: rejectReason.trim(),
			}),
		addInternalReply: () =>
			createCommentMutation.mutate(
				{ comment: internalComment.trim() },
				{ onSuccess: () => setInternalComment("") },
			),
		boardSign: () =>
			boardSignMutation.mutate({
				signature_data: boardSignatureData ?? "",
				signer_name: boardSignerName.trim(),
			}),
		generateBoardSigningLink: () =>
			updateMutation.mutate({
				generate_board_signature_token: true,
			}),
		finalize: () => finalizeMutation.mutate(),
	};
}
