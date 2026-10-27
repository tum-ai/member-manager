import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import {
	ResubmissionNotice,
	ResubmittedBadge,
} from "./ReimbursementResubmissionNotice";

const request: ReimbursementRequest = {
	id: "req-1",
	user_id: "user-1",
	amount: 25,
	date: "2026-06-03",
	description: "Snacks",
	department: "Community",
	submission_type: "reimbursement",
	status: "requested",
	approval_status: "pending",
	payment_status: "to_be_paid",
};

describe("ReimbursementResubmissionNotice", () => {
	it("renders nothing for a request that was never resubmitted", () => {
		const { container } = render(
			<>
				<ResubmittedBadge request={request} />
				<ResubmissionNotice request={request} />
			</>,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("shows reviewers the rejection the member addressed", () => {
		render(
			<>
				<ResubmittedBadge
					request={{
						...request,
						resubmission_count: 2,
						last_rejection_reason: "Receipt is not itemized",
					}}
				/>
				<ResubmissionNotice
					request={{
						...request,
						resubmission_count: 2,
						last_rejection_reason: "Receipt is not itemized",
					}}
				/>
			</>,
		);

		expect(screen.getByText("Resubmitted ×2")).toBeVisible();
		expect(
			screen.getByText("Previously rejected: Receipt is not itemized"),
		).toBeVisible();
	});

	it("labels a single resubmission without a count", () => {
		render(
			<ResubmittedBadge request={{ ...request, resubmission_count: 1 }} />,
		);

		expect(screen.getByText("Resubmitted")).toBeVisible();
	});
});
