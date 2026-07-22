import type { FinanceBudgetTransferRequest } from "@member-manager/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceBudgetTransferSection } from "./FinanceBudgetTransferSection";

const request: FinanceBudgetTransferRequest = {
	id: "10000000-0000-4000-8000-000000000001",
	source_department: "Makeathon",
	target_department: "Community",
	period_type: "year",
	period_key: "2026",
	amount: 1000,
	reason: "Move unused event budget",
	status: "pending",
	requested_by: "20000000-0000-4000-8000-000000000001",
	reviewed_by: null,
	review_note: null,
	reviewed_at: null,
	created_at: "2026-07-21T12:00:00.000Z",
	updated_at: "2026-07-21T12:00:00.000Z",
};

describe("FinanceBudgetTransferSection", () => {
	it("submits and reviews budget transfer requests", async () => {
		const user = userEvent.setup();
		const onCreate = vi.fn().mockResolvedValue(undefined);
		const onReview = vi.fn().mockResolvedValue(undefined);
		renderWithClient(
			<FinanceBudgetTransferSection
				period={{ type: "year", key: "2026" }}
				requests={[request]}
				department={null}
				canManage
				isSubmitting={false}
				reviewingRequestId={null}
				onCreate={onCreate}
				onReview={onReview}
			/>,
		);

		await user.click(screen.getByLabelText("Budget source"));
		await user.click(await screen.findByRole("option", { name: "Makeathon" }));
		await user.click(screen.getByLabelText("Budget destination"));
		await user.click(await screen.findByRole("option", { name: "Community" }));
		await user.type(screen.getByLabelText("Amount (€)"), "500");
		await user.type(screen.getByLabelText("Reason"), "Share venue funds");
		await user.click(screen.getByRole("button", { name: "Request" }));

		await waitFor(() => {
			expect(onCreate).toHaveBeenCalledWith({
				source_department: "Makeathon",
				target_department: "Community",
				period_type: "year",
				period_key: "2026",
				amount: 500,
				reason: "Share venue funds",
			});
		});
		await waitFor(() => {
			expect(screen.getByLabelText("Amount (€)")).toHaveValue(null);
			expect(screen.getByLabelText("Reason")).toHaveValue("");
		});

		await user.type(
			screen.getByLabelText("Review note for budget transfer from Makeathon"),
			"Confirmed",
		);
		await user.click(screen.getByRole("button", { name: "Approve" }));
		expect(onReview).toHaveBeenCalledWith({
			requestId: request.id,
			review: { decision: "approved", review_note: "Confirmed" },
		});
	});

	it("uses the shared schema to reject non-positive amounts", async () => {
		const user = userEvent.setup();
		const onCreate = vi.fn().mockResolvedValue(undefined);
		renderWithClient(
			<FinanceBudgetTransferSection
				period={{ type: "year", key: "2026" }}
				requests={[]}
				department={null}
				canManage
				isSubmitting={false}
				reviewingRequestId={null}
				onCreate={onCreate}
				onReview={vi.fn()}
			/>,
		);

		await user.click(screen.getByLabelText("Budget source"));
		await user.click(await screen.findByRole("option", { name: "Makeathon" }));
		await user.click(screen.getByLabelText("Budget destination"));
		await user.click(await screen.findByRole("option", { name: "Community" }));
		await user.type(screen.getByLabelText("Amount (€)"), "0");
		await user.type(screen.getByLabelText("Reason"), "Invalid amount");

		expect(
			await screen.findByText(/expected number to be >0/),
		).toBeInTheDocument();
		expect(screen.getByLabelText("Amount (€)")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		expect(screen.getByRole("button", { name: "Request" })).toBeDisabled();
		expect(onCreate).not.toHaveBeenCalled();
	});
});
