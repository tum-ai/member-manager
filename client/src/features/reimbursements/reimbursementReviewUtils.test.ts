import { describe, expect, it } from "vitest";
import {
	getBankName,
	getPaymentBic,
	getPaymentIban,
	getReviewStage,
	isClosedReimbursement,
	matchesReimbursementPaymentFilter,
	matchesReimbursementReviewSearch,
} from "./reimbursementReviewUtils";
import type { ReimbursementRequest } from "./reimbursementTypes";

function vividRequest(
	overrides: Partial<ReimbursementRequest> = {},
): ReimbursementRequest {
	return {
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
		...overrides,
	};
}

describe("Vivid reimbursement review presentation", () => {
	it("shows the no-payment stage and hides bank identifiers", () => {
		const request = vividRequest();

		expect(getReviewStage(request)).toBe("No payment required");
		expect(getBankName(request)).toBe("No payment required");
		expect(getPaymentIban(request)).toBe("Not applicable");
		expect(getPaymentBic(request)).toBe("Not applicable");
		expect(
			getReviewStage({
				...request,
				approval_status: "not_approved",
				status: "rejected",
			}),
		).toBe("Rejected");
	});

	it("does not search Vivid requests by bank fallback text", () => {
		const request = vividRequest();

		expect(matchesReimbursementReviewSearch(request, "Not applicable")).toBe(
			false,
		);
		expect(
			matchesReimbursementReviewSearch(request, "Virtual card supplies"),
		).toBe(true);
	});
});

// Pending expenses must stay in the approval queue even though they never need payment.
it("keeps pending Vivid open and closes approved or rejected expenses consistently", () => {
	const pending = vividRequest({ approval_status: "pending" });
	expect(getReviewStage(pending)).toBe("Needs approval");
	expect(isClosedReimbursement(pending)).toBe(false);
	expect(matchesReimbursementPaymentFilter(pending, "closed")).toBe(false);
	for (const approval_status of ["approved", "not_approved"] as const) {
		const request = vividRequest({ approval_status });
		expect(isClosedReimbursement(request)).toBe(true);
		expect(matchesReimbursementPaymentFilter(request, "closed")).toBe(true);
		expect(matchesReimbursementPaymentFilter(request, "paid")).toBe(false);
	}
});
