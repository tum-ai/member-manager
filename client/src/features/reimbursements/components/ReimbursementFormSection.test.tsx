import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	defaultValues,
	type FormValues,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
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
		onCancelEdit: vi.fn(),
	};

	render(
		<ReimbursementFormSection
			values={{ ...defaultValues, ...overrides.values }}
			errors={{}}
			isCreating={false}
			isResubmitting={false}
			editingRequest={null}
			isReceiptBusy={false}
			isDraggingReceipt={false}
			isSubmitDisabled={false}
			canSubmitVivid={true}
			showDepartmentWarning={false}
			{...handlers}
			{...overrides.props}
		/>,
	);

	return handlers;
}

describe("ReimbursementFormSection", () => {
	it("asks for the submission type, then the receipt, then the details", () => {
		renderSection();

		expect(screen.getByText(/drag & drop your receipt/i)).toBeVisible();
		expect(
			screen.queryByRole("heading", { name: /^receipt$/i }),
		).not.toBeInTheDocument();
		const typeToggle = screen.getByRole("group", { name: "Submission type" });
		const receiptText = screen.getByText(/drag & drop your receipt/i);
		const amountInput = screen.getByLabelText(/amount/i);
		expect(
			typeToggle.compareDocumentPosition(receiptText) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			receiptText.compareDocumentPosition(amountInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("shows the IBAN grouped in blocks of four", () => {
		renderSection({ values: { paymentIban: "DE89370400440532013000" } });

		const ibanInput = screen.getByLabelText("IBAN");
		expect(ibanInput).toHaveValue("DE89 3704 0044 0532 0130 00");
		expect(ibanInput).toHaveAttribute("autocapitalize", "characters");
		expect(ibanInput).toHaveAttribute("autocorrect", "off");
	});

	it("reports a pasted IBAN in its cleaned form", async () => {
		const user = userEvent.setup();
		const { onFieldChange } = renderSection();

		await user.click(screen.getByLabelText("IBAN"));
		await user.paste("de12 5001 0517 0648 4898 90");

		expect(onFieldChange).toHaveBeenLastCalledWith(
			"paymentIban",
			"DE12500105170648489890",
		);
	});

	it("attaches the submit-time IBAN error to the field", () => {
		renderSection({
			props: { errors: { paymentIban: "Enter a valid IBAN." } },
		});

		const ibanInput = screen.getByLabelText("IBAN");
		expect(ibanInput).toHaveAttribute("aria-invalid", "true");
		expect(ibanInput).toHaveAccessibleDescription("Enter a valid IBAN.");
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

	describe("while editing a rejected request", () => {
		const editingRequest: ReimbursementRequest = {
			id: "req-rejected",
			user_id: "member-1",
			amount: 25,
			date: "2026-06-03",
			description: "Snacks",
			department: "Community",
			submission_type: "reimbursement",
			status: "rejected",
			approval_status: "not_approved",
			payment_status: "to_be_paid",
			rejection_reason: "Receipt is not itemized",
		};

		it("shows the reason and moves focus to the form", () => {
			renderSection({ props: { editingRequest } });

			const heading = screen.getByRole("heading", {
				name: "Edit rejected request",
			});
			expect(heading).toHaveFocus();
			expect(screen.getByText("Receipt is not itemized")).toBeVisible();
			expect(
				screen.getByRole("button", { name: "Resubmit request" }),
			).toBeEnabled();
		});

		it("lets the member cancel the edit", async () => {
			const user = userEvent.setup();
			const { onCancelEdit } = renderSection({ props: { editingRequest } });

			await user.click(screen.getByRole("button", { name: "Cancel" }));

			expect(onCancelEdit).toHaveBeenCalledTimes(1);
		});

		it("shows progress while resubmitting", () => {
			renderSection({
				props: {
					editingRequest,
					isResubmitting: true,
					isSubmitDisabled: true,
				},
			});

			expect(
				screen.getByRole("button", { name: "Resubmitting..." }),
			).toBeDisabled();
			expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		});
	});
});
