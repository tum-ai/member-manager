import type { ContractSubmission } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { ContractSubmissionSignatureSections } from "./ContractSubmissionSignatureSections";

const submission = {
	id: "submission-123456789",
	status: "partner_signed",
	signature_data: "data:image/png;base64,c2lnbmF0dXJl",
	signer_name: "Partner Signer",
	signed_at: "2026-07-15T08:00:00Z",
	admin_signature_data: null,
	admin_signer_name: null,
	admin_signed_at: null,
} as unknown as ContractSubmission;

const detail = {
	submission,
	isContractsAdmin: true,
	isBoardMember: true,
	boardSignatureData: "data:image/png;base64,Ym9hcmQ=",
	boardSignerName: "Board Signer",
	boardSignUrl: null,
	busy: false,
	setBoardSignerName: fn(),
	setBoardSignatureData: fn(),
	boardSign: fn(),
	generateBoardSigningLink: fn(),
	finalize: fn(),
} as unknown as ContractSubmissionDetailViewModel;

const meta = {
	title: "Contracts/SubmissionSignatures",
	component: ContractSubmissionSignatureSections,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		submission,
		detail,
	},
} satisfies Meta<typeof ContractSubmissionSignatureSections>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BoardSignatureActions: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Board sign" }));
		await expect(args.detail.boardSign).toHaveBeenCalledOnce();
		await userEvent.click(
			canvas.getByRole("button", { name: "Generate board signing link" }),
		);
		await expect(args.detail.generateBoardSigningLink).toHaveBeenCalledOnce();
	},
};

export const FinalizeContract: Story = {
	args: {
		submission: {
			...submission,
			status: "board_signed",
		},
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Generate final PDF link" }),
		);
		await expect(args.detail.finalize).toHaveBeenCalledOnce();
	},
};
