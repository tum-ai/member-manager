import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReimbursementReviewActions } from "./ReimbursementReviewActions";
import type { ReimbursementRequest } from "./reimbursementTypes";

const vividRequest: ReimbursementRequest = {
	id: "vivid-1",
	user_id: "member-1",
	amount: 120,
	date: "2026-06-12",
	description: "Virtual card supplies",
	department: "Makeathon",
	submission_type: "vivid_reimbursement",
	status: "requested",
	approval_status: "approved",
	payment_status: "not_required",
};

function renderActions(request: ReimbursementRequest) {
	const onReview = vi.fn(async () => undefined);
	render(
		<ReimbursementReviewActions
			request={request}
			isReviewing={false}
			rejectionReason=""
			onReasonChange={vi.fn()}
			onReview={onReview}
		/>,
	);
	return onReview;
}

describe("ReimbursementReviewActions", () => {
	const pendingRequest: ReimbursementRequest = {
		...vividRequest,
		submission_type: "reimbursement",
		approval_status: "pending",
		payment_status: "to_be_paid",
	};

	it("starts with a plain Approve that sends the approve action", () => {
		const onReview = renderActions(pendingRequest);

		screen.getByRole("button", { name: "Approve" }).click();
		expect(onReview).toHaveBeenCalledWith("approve");
		expect(
			screen.queryByRole("button", { name: "Final approval" }),
		).not.toBeInTheDocument();
	});

	it("offers the final approval (and still rejection) after the first one", () => {
		const onReview = renderActions({
			...pendingRequest,
			first_approved_at: "2026-10-17T10:00:00Z",
		});

		screen.getByRole("button", { name: "Final approval" }).click();
		expect(onReview).toHaveBeenCalledWith("approve");
		expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
	});

	it("does not offer Mark paid for an approved Vivid expense", () => {
		render(
			<ReimbursementReviewActions
				request={vividRequest}
				isReviewing={false}
				rejectionReason=""
				onReasonChange={vi.fn()}
				onReview={vi.fn(async () => undefined)}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: /mark paid/i }),
		).not.toBeInTheDocument();
	});
});
