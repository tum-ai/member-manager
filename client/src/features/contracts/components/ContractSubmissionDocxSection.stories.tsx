import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { ContractSubmissionDocxSection } from "./ContractSubmissionDocxSection";

const detail = {
	isContractsAdmin: true,
	documentStatus: "ready",
	storedPdfUrl: null,
	storedPdfLoading: false,
	storedPdfError: null,
	docxDownloading: false,
	docxDownloadError: null,
	docxUploadPending: false,
	docxUploadError: null,
	pendingDocxFileName: null,
	notes: "Reviewed by Legal",
	downloadDocx: fn(),
	requestDocxUpload: fn(),
	cancelDocxUpload: fn(),
	confirmDocxUpload: fn(),
	setNotes: fn(),
} as unknown as ContractSubmissionDetailViewModel;

const meta = {
	title: "Contracts/SubmissionDocx",
	component: ContractSubmissionDocxSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: { detail },
} satisfies Meta<typeof ContractSubmissionDocxSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LegalActions: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Download DOCX" }),
		);
		await expect(args.detail.downloadDocx).toHaveBeenCalled();
		await userEvent.upload(
			canvas.getByLabelText("Upload edited DOCX"),
			new File(["docx"], "edited.docx", {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}),
		);
		await expect(args.detail.requestDocxUpload).toHaveBeenCalled();
	},
};

export const ConfirmReplacement: Story = {
	args: {
		detail: { ...detail, pendingDocxFileName: "edited.docx" },
	},
	play: async ({ args }) => {
		const body = within(document.body);
		await userEvent.click(
			body.getByRole("button", { name: "Upload new version" }),
		);
		await expect(args.detail.confirmDocxUpload).toHaveBeenCalled();
	},
};
