import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { ReimbursementRequestDetailDialog } from "./ReimbursementRequestDetailDialog";

const FULL_IBAN = "DE89370400440532013000";

const rejectedInvoice: ReimbursementRequest = {
	id: "req-rejected",
	user_id: "member-1",
	amount: 128.9,
	date: "2026-06-03",
	description:
		"Makeathon prototype materials\nSensors, jumper wires and a spare Raspberry Pi.",
	department: "Makeathon",
	submission_type: "invoice",
	payment_iban: FULL_IBAN,
	payment_bic: "COBADEFFXXX",
	receipt_filename: "prototype-invoice.pdf",
	receipt_view_url: "/api/reimbursements/req-rejected/receipt",
	receipt_download_url: "/api/reimbursements/req-rejected/receipt?download=1",
	status: "rejected",
	approval_status: "not_approved",
	payment_status: "to_be_paid",
	rejection_reason: "Please upload the itemised invoice from the vendor.",
	created_at: "2026-06-03T09:12:00Z",
	updated_at: "2026-06-05T14:30:00Z",
};

const vividExpense: ReimbursementRequest = {
	id: "req-vivid",
	user_id: "member-1",
	amount: 19.99,
	date: "2026-05-28",
	description: "Community stickers",
	department: "Community",
	submission_type: "vivid_reimbursement",
	receipt_filename: "stickers.png",
	receipt_view_url: "/api/reimbursements/req-vivid/receipt",
	receipt_download_url: "/api/reimbursements/req-vivid/receipt?download=1",
	status: "requested",
	approval_status: "approved",
	payment_status: "not_required",
	created_at: "2026-05-28T08:00:00Z",
	updated_at: "2026-05-29T10:00:00Z",
};

// Rendered open so the a11y audit runs against the dialog content. The dialog
// is portalled, so play functions query `document.body`.
const meta = {
	title: "Features/Reimbursements/ReimbursementRequestDetailDialog",
	component: ReimbursementRequestDetailDialog,
	parameters: {
		layout: "centered",
		a11y: { test: "error" },
	},
	args: {
		request: rejectedInvoice,
		open: true,
		onOpenChange: fn(),
		onViewReceipt: fn(),
		onDownloadReceipt: fn(),
		isOpeningReceipt: false,
		isDownloadingReceipt: false,
	},
} satisfies Meta<typeof ReimbursementRequestDetailDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RejectedInvoice: Story = {
	play: async ({ args }) => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog", {
			name: "Invoice request",
		});
		const details = within(dialog);

		await expect(details.getByText("DE89 •••• •••• 3000")).toBeVisible();
		await expect(dialog).not.toHaveTextContent(FULL_IBAN);
		await expect(details.getByText("COBADEFFXXX")).toBeVisible();
		await expect(details.getByText("Makeathon")).toBeVisible();
		await expect(
			details.getByText("Please upload the itemised invoice from the vendor."),
		).toBeVisible();

		await userEvent.click(
			details.getByRole("button", { name: "View receipt" }),
		);
		await expect(args.onViewReceipt).toHaveBeenCalledTimes(1);
		await userEvent.click(
			details.getByRole("button", { name: "Download receipt" }),
		);
		await expect(args.onDownloadReceipt).toHaveBeenCalledTimes(1);
	},
};

export const VividExpense: Story = {
	args: { request: vividExpense },
	play: async () => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog", {
			name: "Vivid Reimbursement request",
		});
		const details = within(dialog);

		await expect(details.getByText("Payout")).toBeVisible();
		await expect(details.queryByText("IBAN")).not.toBeInTheDocument();
		await expect(details.queryByText("BIC")).not.toBeInTheDocument();
	},
};

export const ReceiptLoading: Story = {
	args: { isOpeningReceipt: true, isDownloadingReceipt: true },
	play: async () => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog");
		const details = within(dialog);

		await expect(
			details.getByRole("button", { name: "Opening..." }),
		).toBeDisabled();
		await expect(
			details.getByRole("button", { name: "Downloading..." }),
		).toBeDisabled();
	},
};
