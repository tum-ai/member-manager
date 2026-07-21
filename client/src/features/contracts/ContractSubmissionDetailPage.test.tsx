import type { ContractSubmission } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ContractSubmissionDetailPage from "./ContractSubmissionDetailPage";
import type { ContractSubmissionDetailViewModel } from "./contractSubmissionDetailTypes";

const state = vi.hoisted(() => ({
	detail: null as ContractSubmissionDetailViewModel | null,
}));

vi.mock("./hooks/useContractSubmissionDetail", () => ({
	useContractSubmissionDetail: () => state.detail,
}));

const noop = () => undefined;
const noopAsync = async () => undefined;

function createDetail(): ContractSubmissionDetailViewModel {
	const submission = {
		id: "submission-123456789",
		submitter_user_id: "submitter-1",
		form_data: { partner_company_name: "Example GmbH" },
		generated_contract_text: "Contract body",
		admin_edited_text: null,
		status: "submitted",
		notes: null,
		feedback_message: null,
		signature_token: null,
		final_pdf_token: null,
		board_signature_token: null,
		partner_comment: null,
		signature_data: null,
		admin_signature_data: null,
	} as unknown as ContractSubmission;

	return {
		id: submission.id,
		submission,
		submissionLoading: false,
		submissionError: null,
		title: "Submission submissio…",
		editedText: "Contract body",
		notes: "",
		clarificationMessage: "",
		rejectReason: "",
		internalComment: "",
		boardSignatureData: null,
		boardSignerName: "",
		partnerEmailSubject: "",
		partnerEmailMessage: "",
		downloadError: null,
		downloading: false,
		isContractsAdmin: false,
		isBoardMember: false,
		previewPages: undefined,
		previewLoading: false,
		busy: false,
		actionError: null,
		comments: [],
		commentsLoading: false,
		commentsError: null,
		hasLegacyComment: false,
		statusEvents: [],
		statusEventsLoading: false,
		formEntries: Object.entries(submission.form_data),
		canEditDraft: false,
		canSendToPartner: false,
		canApprove: true,
		canRequestClarification: true,
		signUrl: null,
		finalPdfUrl: null,
		boardSignUrl: null,
		resendConfirmationOpen: false,
		setEditedText: noop,
		setNotes: noop,
		setClarificationMessage: noop,
		setRejectReason: noop,
		setInternalComment: noop,
		setBoardSignatureData: noop,
		setBoardSignerName: noop,
		setPartnerEmailSubject: noop,
		setPartnerEmailMessage: noop,
		setManualStatus: noop,
		setAutoSendAfterBoardSigned: noop,
		confirmResend: noop,
		cancelResend: noop,
		saveChanges: noop,
		downloadPdf: noopAsync,
		sendToPartner: noop,
		sendEmailToPartner: noop,
		sendWithOpenSign: noop,
		approve: noop,
		requestClarification: noop,
		reject: noop,
		addInternalReply: noop,
		boardSign: noop,
		generateBoardSigningLink: noop,
		finalize: noop,
	};
}

describe("ContractSubmissionDetailPage", () => {
	it("renders the loaded submission through its presentational sections", () => {
		state.detail = createDetail();

		render(
			<MemoryRouter>
				<ContractSubmissionDetailPage />
			</MemoryRouter>,
		);

		expect(
			screen.getByRole("heading", { name: "Submission submissio…" }),
		).toBeInTheDocument();
		expect(screen.getByText("Example GmbH")).toBeInTheDocument();
		expect(screen.getByText("Contract body")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
		expect(screen.getByText("No partner comments yet.")).toBeInTheDocument();
	});
});
