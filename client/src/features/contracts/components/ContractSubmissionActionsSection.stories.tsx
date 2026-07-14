import type { ContractSubmission } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { ContractSubmissionActionsSection } from "./ContractSubmissionActionsSection";

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

const detail = {
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
	partnerEmailSubject: "TUM.ai contract for Example GmbH",
	partnerEmailMessage:
		"Please review and sign the contract using the secure link below.",
	downloadError: null,
	downloading: false,
	isContractsAdmin: true,
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
	setEditedText: fn(),
	setNotes: fn(),
	setClarificationMessage: fn(),
	setRejectReason: fn(),
	setInternalComment: fn(),
	setBoardSignatureData: fn(),
	setBoardSignerName: fn(),
	setPartnerEmailSubject: fn(),
	setPartnerEmailMessage: fn(),
	setManualStatus: fn(),
	setAutoSendAfterBoardSigned: fn(),
	confirmResend: fn(),
	cancelResend: fn(),
	saveChanges: fn(),
	downloadPdf: fn(async () => undefined),
	sendToPartner: fn(),
	sendEmailToPartner: fn(),
	sendWithOpenSign: fn(),
	approve: fn(),
	requestClarification: fn(),
	reject: fn(),
	addInternalReply: fn(),
	boardSign: fn(),
	generateBoardSigningLink: fn(),
	finalize: fn(),
} satisfies ContractSubmissionDetailViewModel;

const meta = {
	title: "Contracts/SubmissionActions",
	component: ContractSubmissionActionsSection,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
	args: {
		submission,
		detail,
	},
} satisfies Meta<typeof ContractSubmissionActionsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReviewActions: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
		await expect(args.detail.approve).toHaveBeenCalledOnce();
	},
};
