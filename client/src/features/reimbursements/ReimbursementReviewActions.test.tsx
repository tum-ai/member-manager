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

describe("ReimbursementReviewActions", () => {
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
