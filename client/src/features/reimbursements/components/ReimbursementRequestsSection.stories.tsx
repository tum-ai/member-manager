import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { ReimbursementRequestDetailDialog } from "./ReimbursementRequestDetailDialog";
import { ReimbursementRequestsSection } from "./ReimbursementRequestsSection";

const FULL_IBAN = "DE89370400440532013000";

const requests: ReimbursementRequest[] = [
	{
		id: "req-rejected",
		user_id: "member-1",
		amount: 128.9,
		date: "2026-06-03",
		description: "Makeathon prototype materials",
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
	},
	{
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
	},
	{
		id: "req-paid",
		user_id: "member-1",
		amount: 42.5,
		date: "2026-05-14",
		description: "Train ticket to the Munich AI meetup",
		department: "Software Development",
		submission_type: "reimbursement",
		payment_iban: FULL_IBAN,
		payment_bic: "COBADEFFXXX",
		receipt_filename: "train.pdf",
		receipt_view_url: "/api/reimbursements/req-paid/receipt",
		receipt_download_url: "/api/reimbursements/req-paid/receipt?download=1",
		status: "paid",
		approval_status: "approved",
		payment_status: "paid",
		created_at: "2026-05-14T18:00:00Z",
		updated_at: "2026-05-20T09:00:00Z",
	},
];

const onViewReceipt = fn();
const onDownloadReceipt = fn();

const meta = {
	title: "Features/Reimbursements/ReimbursementRequestsSection",
	component: ReimbursementRequestsSection,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		isLoading: false,
		error: null,
		requests,
		onSelectRequest: fn(),
	},
	render: (args) => (
		<div className="w-[34rem] max-w-full">
			<ReimbursementRequestsSection {...args} />
		</div>
	),
} satisfies Meta<typeof ReimbursementRequestsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

// The card's aria-label replaces its content for screen readers, so the
// status (and a rejection reason) must be part of the accessible name.
export const AnnouncesStatus: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("button", {
				name: /invoice request from 03 jun 2026 .*status: not approved\. reason: please upload the itemised invoice from the vendor\./i,
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", {
				name: /vivid reimbursement request .*status: no payment required$/i,
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", {
				name: /reimbursement request from 14 may 2026 .*status: paid$/i,
			}),
		).toBeVisible();
	},
};

// Each card is a real button: mouse and keyboard both select the request.
export const SelectsRequest: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await userEvent.click(
			canvas.getByRole("button", {
				name: /view details for invoice request from 03 jun 2026/i,
			}),
		);
		await expect(args.onSelectRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: "req-rejected" }),
		);

		const vividTrigger = canvas.getByRole("button", {
			name: /view details for vivid reimbursement request/i,
		});
		vividTrigger.focus();
		await expect(vividTrigger).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(args.onSelectRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: "req-vivid" }),
		);
	},
};

export const Empty: Story = {
	args: { requests: [] },
};

function SectionWithDetail(
	props: ComponentProps<typeof ReimbursementRequestsSection>,
) {
	const [selected, setSelected] = useState<ReimbursementRequest | null>(null);
	const [open, setOpen] = useState(false);

	return (
		<>
			<ReimbursementRequestsSection
				{...props}
				onSelectRequest={(request) => {
					props.onSelectRequest(request);
					setSelected(request);
					setOpen(true);
				}}
			/>
			<ReimbursementRequestDetailDialog
				request={selected}
				open={open}
				onOpenChange={setOpen}
				onViewReceipt={onViewReceipt}
				onDownloadReceipt={onDownloadReceipt}
				isOpeningReceipt={false}
				isDownloadingReceipt={false}
			/>
		</>
	);
}

// Opening a request shows what the member entered, with the IBAN masked. The
// dialog renders in a Radix portal, so it is queried from `document.body`.
export const OpensRequestDetail: Story = {
	render: (args) => (
		<div className="w-[34rem] max-w-full">
			<SectionWithDetail {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(document.body);

		const trigger = canvas.getByRole("button", {
			name: /view details for invoice request from 03 jun 2026/i,
		});
		await userEvent.click(trigger);

		const dialog = await body.findByRole("dialog", {
			name: "Invoice request",
		});
		const details = within(dialog);
		await expect(details.getByText("Makeathon")).toBeVisible();
		await expect(details.getByText("DE89 •••• •••• 3000")).toBeVisible();
		await expect(details.getByText("COBADEFFXXX")).toBeVisible();
		await expect(
			details.getByText("Please upload the itemised invoice from the vendor."),
		).toBeVisible();
		await expect(dialog).not.toHaveTextContent(FULL_IBAN);

		await userEvent.click(
			details.getByRole("button", { name: "View receipt" }),
		);
		await expect(onViewReceipt).toHaveBeenCalled();
		await userEvent.click(
			details.getByRole("button", { name: "Download receipt" }),
		);
		await expect(onDownloadReceipt).toHaveBeenCalled();

		// Closing returns focus to the card that opened the dialog. The open
		// dialog itself is audited in ReimbursementRequestDetailDialog.stories.
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};
