import type { ContractSubmission } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ContractSubmissionCommentsSection } from "./ContractSubmissionCommentsSection";

const meta = {
	title: "Contracts/SubmissionComments",
	component: ContractSubmissionCommentsSection,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		submission: {
			partner_comment: null,
		} as unknown as ContractSubmission,
		comments: [
			{
				id: "comment-1",
				submission_id: "submission-1",
				author_type: "partner",
				author_name: "Partner Signer",
				author_email: null,
				comment: "Please update the payment term.",
				document_version_id: null,
				created_at: "2026-07-15T08:00:00Z",
			},
		],
		commentsLoading: false,
		commentsError: null,
		hasLegacyComment: false,
		isContractsAdmin: true,
		internalComment: "We updated the requested term.",
		busy: false,
		onInternalCommentChange: fn(),
		onAddInternalReply: fn(),
	},
} satisfies Meta<typeof ContractSubmissionCommentsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InternalReply: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.clear(canvas.getByLabelText("Internal reply"));
		await userEvent.type(
			canvas.getByLabelText("Internal reply"),
			"Approved wording attached.",
		);
		await expect(args.onInternalCommentChange).toHaveBeenCalled();
		await userEvent.click(
			canvas.getByRole("button", { name: "Add internal reply" }),
		);
		await expect(args.onAddInternalReply).toHaveBeenCalledOnce();
	},
};
