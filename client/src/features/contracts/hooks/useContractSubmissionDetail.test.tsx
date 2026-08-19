import type { ContractSubmission } from "@member-manager/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContractSubmissionDetail } from "./useContractSubmissionDetail";

const mocks = vi.hoisted(() => ({
	update: vi.fn(),
	boardSign: vi.fn(),
	finalize: vi.fn(),
	createComment: vi.fn(),
	downloadPdf: vi.fn(),
	downloadDocx: vi.fn(),
	uploadDocx: vi.fn(),
	preview: vi.fn(),
	submissionQuery: {
		data: undefined as ContractSubmission | undefined,
		isLoading: false,
		error: null as Error | null,
	},
}));

vi.mock("react-router-dom", () => ({
	useParams: () => ({ id: "submission-123456789" }),
}));

vi.mock("@/hooks/useCurrentUserIsAdmin", () => ({
	useCurrentUserIsAdmin: () => ({
		currentUserId: "submitter-1",
		isAdmin: false,
	}),
}));

vi.mock("@/hooks/useToolAccess", () => ({
	useToolAccess: () => ({
		permissions: ["contracts.admin"],
		isBoardMember: true,
	}),
}));

vi.mock("@/features/contracts/contractApi", () => ({
	downloadContractSubmissionPdf: mocks.downloadPdf,
	downloadContractSubmissionDocx: mocks.downloadDocx,
}));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("./useContractSubmissions", () => ({
	useContractSubmission: () => mocks.submissionQuery,
	useContractSubmissionPdf: () => ({
		data: undefined,
		isLoading: false,
		isFetching: false,
		error: null,
	}),
	useUploadContractSubmissionDocx: () => ({
		mutate: mocks.uploadDocx,
		isPending: false,
		error: null,
	}),
	useUpdateContractSubmission: () => ({
		mutate: mocks.update,
		isPending: false,
		error: null,
	}),
	useBoardSignContractSubmission: () => ({
		mutate: mocks.boardSign,
		isPending: false,
		error: null,
	}),
	useFinalizeContractSubmission: () => ({
		mutate: mocks.finalize,
		isPending: false,
		error: null,
	}),
	useContractSubmissionComments: () => ({
		data: [],
		isLoading: false,
		error: null,
	}),
	useCreateContractSubmissionComment: () => ({
		mutate: mocks.createComment,
		isPending: false,
		error: null,
	}),
	useContractStatusEvents: () => ({
		data: [],
		isLoading: false,
	}),
	useContractSubmissionPreview: (...args: unknown[]) => {
		mocks.preview(...args);
		return {
			data: { pages: ["<p>Preview</p>"] },
			isLoading: false,
			isFetching: false,
		};
	},
}));

function createSubmission(
	overrides: Partial<ContractSubmission> = {},
): ContractSubmission {
	return {
		id: "submission-123456789",
		submitter_user_id: "submitter-1",
		form_data: { partner_company_name: "Example GmbH" },
		generated_contract_text: "Generated text",
		admin_edited_text: "Edited text",
		status: "approved",
		notes: "Existing notes",
		feedback_message: "Existing feedback",
		signature_token: "partner-token",
		board_signature_token: "board-token",
		final_pdf_token: "pdf-token",
		partner_comment: null,
		...overrides,
	} as ContractSubmission;
}

describe("useContractSubmissionDetail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.submissionQuery.data = createSubmission();
		mocks.submissionQuery.isLoading = false;
		mocks.submissionQuery.error = null;
		mocks.downloadPdf.mockResolvedValue(undefined);
		mocks.downloadDocx.mockResolvedValue(undefined);
	});

	it("keeps DOCX edits out of send payloads and confirms replacements", async () => {
		mocks.submissionQuery.data = createSubmission({
			status: "approved",
			...({
				renderer_engine: "docx",
				template_document_id: "doc-1",
				document_status: "ready",
			} as Partial<ContractSubmission>),
		});
		const file = new File(["docx"], "edited.docx", {
			type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});
		const { result } = renderHook(() => useContractSubmissionDetail());
		await waitFor(() => expect(result.current.isDocxDocument).toBe(true));

		act(() => result.current.sendToPartner());
		expect(mocks.update).toHaveBeenLastCalledWith({
			notes: "Existing notes",
			send_to_partner: true,
		});

		act(() => result.current.requestDocxUpload(file));
		expect(result.current.pendingDocxFileName).toBe("edited.docx");
		expect(mocks.uploadDocx).not.toHaveBeenCalled();

		act(() => result.current.confirmDocxUpload());
		expect(mocks.uploadDocx).toHaveBeenCalledWith(
			file,
			expect.objectContaining({ onSuccess: expect.any(Function) }),
		);
	});

	it("initializes editable fields and derives workflow actions", async () => {
		const { result } = renderHook(() => useContractSubmissionDetail());

		await waitFor(() => expect(result.current.editedText).toBe("Edited text"));

		expect(result.current.notes).toBe("Existing notes");
		expect(result.current.clarificationMessage).toBe("Existing feedback");
		expect(result.current.partnerEmailSubject).toBe(
			"TUM.ai contract for Example GmbH",
		);
		expect(result.current.partnerEmailMessage).toBe(
			"Please review and sign the contract using the secure link below.",
		);
		expect(result.current.canSendToPartner).toBe(true);
		expect(result.current.canApprove).toBe(false);
		expect(result.current.canRequestClarification).toBe(false);
		expect(result.current.signUrl).toBe(
			`${window.location.origin}/contracts/sign/partner-token`,
		);
		expect(result.current.boardSignUrl).toBe(
			`${window.location.origin}/contracts/board-sign/board-token`,
		);
		expect(result.current.finalPdfUrl).toBe(
			`${window.location.origin}/api/contracts/final/pdf-token/pdf`,
		);
		expect(mocks.preview).toHaveBeenLastCalledWith(
			"submission-123456789",
			"Edited text",
		);
	});

	it("keeps action payload construction and state transitions in the hook", async () => {
		mocks.submissionQuery.data = createSubmission({ status: "inquiry" });
		mocks.createComment.mockImplementation(
			(_body: { comment: string }, options: { onSuccess: () => void }) =>
				options.onSuccess(),
		);
		const { result } = renderHook(() => useContractSubmissionDetail());
		await waitFor(() => expect(result.current.editedText).toBe("Edited text"));

		act(() => {
			result.current.setNotes("Updated notes");
			result.current.setClarificationMessage("  Need details  ");
			result.current.setRejectReason("  Not suitable  ");
			result.current.setInternalComment("  Internal reply  ");
		});

		act(() => result.current.requestClarification());
		expect(mocks.update).toHaveBeenLastCalledWith({
			status: "inquiry",
			notes: "Updated notes",
			feedback_message: "Need details",
		});

		act(() => result.current.reject());
		expect(mocks.update).toHaveBeenLastCalledWith({
			status: "rejected",
			notes: "Updated notes",
			rejection_reason: "Not suitable",
		});

		act(() => result.current.addInternalReply());
		expect(mocks.createComment).toHaveBeenCalledWith(
			{ comment: "Internal reply" },
			expect.objectContaining({ onSuccess: expect.any(Function) }),
		);
		expect(result.current.internalComment).toBe("");
	});
});
