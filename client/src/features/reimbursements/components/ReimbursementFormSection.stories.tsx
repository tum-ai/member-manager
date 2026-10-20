import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FormEvent, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
	defaultValues,
	type FormValues,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { ReimbursementFormSection } from "./ReimbursementFormSection";

const meta = {
	title: "Features/Reimbursements/ReimbursementFormSection",
	component: ReimbursementFormSection,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		values: defaultValues,
		errors: {},
		isCreating: false,
		isResubmitting: false,
		editingRequest: null,
		onCancelEdit: fn(),
		isReceiptBusy: false,
		isDraggingReceipt: false,
		isSubmitDisabled: false,
		canSubmitVivid: true,
		showDepartmentWarning: false,
		onDraggingChange: fn(),
		onReceiptDrop: fn(),
		onReceiptChange: fn(),
		onSubmissionTypeChange: fn(),
		onFieldChange: fn(),
		onSubmit: fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()),
	},
} satisfies Meta<typeof ReimbursementFormSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EligibleMember: Story = {
	render: (args) => {
		const [values, setValues] = useState<FormValues>(args.values);

		return (
			<ReimbursementFormSection
				{...args}
				values={values}
				onSubmissionTypeChange={(nextType) => {
					if (nextType) {
						setValues((current) => ({
							...current,
							submissionType: nextType,
						}));
					}
				}}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("radio", { name: "Vivid" }));
		await expect(
			canvas.getByText(/no payment details are required/i),
		).toBeVisible();
		await expect(canvas.queryByLabelText(/iban/i)).not.toBeInTheDocument();
		await expect(canvas.queryByLabelText(/bic/i)).not.toBeInTheDocument();
	},
};

const rejectedRequest: ReimbursementRequest = {
	id: "req-rejected",
	user_id: "member-1",
	amount: 128.9,
	date: "2026-06-03",
	description: "Makeathon prototype materials",
	department: "Makeathon",
	submission_type: "invoice",
	payment_iban: "DE89370400440532013000",
	payment_bic: "COBADEFFXXX",
	receipt_filename: "prototype-invoice.pdf",
	status: "rejected",
	approval_status: "not_approved",
	payment_status: "to_be_paid",
	rejection_reason: "Please upload the itemised invoice from the vendor.",
};

// Editing a rejected request: the reason stays in view, the attached receipt is
// kept unless replaced, and the member can back out.
export const EditingRejectedRequest: Story = {
	args: {
		editingRequest: rejectedRequest,
		values: {
			submissionType: "invoice",
			amount: "128.9",
			date: "2026-06-03",
			description: "Makeathon prototype materials",
			department: "Makeathon",
			paymentIban: "DE89370400440532013000",
			paymentBic: "COBADEFFXXX",
			receipt: {
				fileName: "prototype-invoice.pdf",
				mimeType: "application/pdf",
				sizeBytes: 0,
				storageBucket: "",
				storagePath: "",
				existing: true,
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Edit rejected request" }),
		).toBeVisible();
		await expect(
			canvas.getByText("Please upload the itemised invoice from the vendor."),
		).toBeVisible();
		await expect(canvas.getByText("prototype-invoice.pdf")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Resubmit request" }),
		).toBeEnabled();
		await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
		await expect(args.onCancelEdit).toHaveBeenCalledTimes(1);
	},
};
