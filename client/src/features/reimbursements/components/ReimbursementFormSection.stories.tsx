import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FormEvent, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
	defaultValues,
	type FormValues,
} from "@/features/reimbursements/reimbursementSubmitUtils";
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
