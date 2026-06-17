import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	defaultValues,
	type FormValues,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import { ReimbursementFormSection } from "./ReimbursementFormSection";

function renderSection(
	overrides: {
		values?: Partial<FormValues>;
		props?: Partial<Parameters<typeof ReimbursementFormSection>[0]>;
	} = {},
) {
	const handlers = {
		onDraggingChange: vi.fn(),
		onReceiptDrop: vi.fn(),
		onReceiptChange: vi.fn(),
		onSubmissionTypeChange: vi.fn(),
		onFieldChange: vi.fn(),
		onSubmit: vi.fn((event) => event.preventDefault()),
	};

	render(
		<ReimbursementFormSection
			values={{ ...defaultValues, ...overrides.values }}
			errors={{}}
			isCreating={false}
			isReceiptBusy={false}
			isDraggingReceipt={false}
			isSubmitDisabled={false}
			showDepartmentWarning={false}
			{...handlers}
			{...overrides.props}
		/>,
	);

	return handlers;
}

describe("ReimbursementFormSection", () => {
	it("renders the receipt-first form without a redundant receipt heading", () => {
		renderSection();

		expect(screen.getByText(/drag & drop your receipt/i)).toBeVisible();
		expect(
			screen.queryByRole("heading", { name: /^receipt$/i }),
		).not.toBeInTheDocument();
		const receiptText = screen.getByText(/drag & drop your receipt/i);
		const amountInput = screen.getByLabelText(/amount/i);
		expect(
			receiptText.compareDocumentPosition(amountInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("calls onFieldChange when typing into the amount field", async () => {
		const user = userEvent.setup();
		const { onFieldChange } = renderSection();

		await user.type(screen.getByLabelText(/amount/i), "5");

		expect(onFieldChange).toHaveBeenCalledWith("amount", "5");
	});

	it("toggles submission type via the toggle group", async () => {
		const user = userEvent.setup();
		const { onSubmissionTypeChange } = renderSection();

		await user.click(screen.getByRole("radio", { name: /^invoice$/i }));

		expect(onSubmissionTypeChange).toHaveBeenCalledWith("invoice");
	});

	it("renders the department override warning when flagged", () => {
		renderSection({ props: { showDepartmentWarning: true } });

		expect(
			screen.getByText(/different from your member department/i),
		).toBeInTheDocument();
	});

	it("shows field errors and disables submit while creating", () => {
		renderSection({
			props: {
				isCreating: true,
				isSubmitDisabled: true,
				errors: { amount: "Enter a positive amount." },
			},
		});

		expect(screen.getByText("Enter a positive amount.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
	});

	it("submits the form", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderSection();

		await user.click(screen.getByRole("button", { name: /submit request/i }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
