import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ContractTemplateEditorViewModel } from "@/features/contracts/contractTemplatesPageTypes";
import { ContractTemplateDocumentsPanel } from "./ContractTemplateDocumentsPanel";

const readyDocument = {
	id: "doc-1",
	template_id: "template-1",
	version: 1,
	status: "ready" as const,
	source_bucket: "contract-template-documents",
	source_path: "template-1/1.docx",
	original_filename: "Sponsorship.docx",
	source_size_bytes: 245_000,
	source_sha256: "0f5086d9f70b123456789",
	preview_bucket: "contract-render-artifacts",
	preview_path: "template-1/1.pdf",
	preview_size_bytes: 200_000,
	preview_sha256: "ab123",
	placeholder_manifest: { partner_name: true, partner_signature: true },
	validation_issues: [],
	signature_anchors: [],
	converter_version: "1.0.0",
	error_code: null,
	error_message: null,
	uploaded_by_user_id: "user-1",
	activated_at: "2026-08-19T10:01:00Z",
	created_at: "2026-08-19T10:00:00Z",
	updated_at: "2026-08-19T10:00:00Z",
};

const model = {
	documents: [{ ...readyDocument, id: "doc-2", version: 2 }, readyDocument],
	activeDocumentId: "doc-2",
	previewDocumentId: null,
	previewPdfUrl: null,
	previewLoading: false,
	previewError: null,
	uploadPending: false,
	uploadError: null,
	retryingDocumentId: null,
	retryError: null,
	activatingDocumentId: null,
	activateError: null,
	uploadDocument: fn(),
	retryDocument: fn(),
	activateDocument: fn(),
	previewDocument: fn(),
} as unknown as ContractTemplateEditorViewModel;

const meta = {
	title: "Contracts/TemplateDocuments",
	component: ContractTemplateDocumentsPanel,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: { model },
} satisfies Meta<typeof ContractTemplateDocumentsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VersionHistory: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Roll back" }));
		await expect(args.model.activateDocument).toHaveBeenCalledWith("doc-1");
		await userEvent.upload(
			canvas.getByLabelText("Upload DOCX"),
			new File(["docx"], "replacement.docx", {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}),
		);
		await expect(args.model.uploadDocument).toHaveBeenCalled();
	},
};
