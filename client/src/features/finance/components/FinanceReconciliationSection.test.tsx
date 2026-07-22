import type {
	FinancePlanItem,
	FinanceProject,
	FinanceReallocationRequest,
	FinanceReconciliationResponse,
} from "@member-manager/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceReconciliationSection } from "./FinanceReconciliationSection";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const PLAN_ITEM_ID = "20000000-0000-4000-8000-000000000001";
const REQUEST_ID = "30000000-0000-4000-8000-000000000001";
const ALLOCATION_ID = "40000000-0000-4000-8000-000000000001";

const projects: FinanceProject[] = [
	{
		id: PROJECT_ID,
		parent_project_id: null,
		name: "Makeathon 2026",
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		tax_area: "wirtschaftlich",
		target_amount: -20000,
		status: "active",
		description: null,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	},
];

const planItems: FinancePlanItem[] = [
	{
		id: PLAN_ITEM_ID,
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		label: "Venue",
		category: "Location",
		planned_amount: 5000,
		expected_month: "2026-05",
		status: "planned",
		note: null,
	},
];

const reconciliation: FinanceReconciliationResponse = {
	period_type: "year",
	period_key: "2026",
	matches: [],
	unmatched_postings: [
		{
			posting: {
				external_id: "BB-1",
				date: "2026-05-04",
				postingtext: "Makeathon venue",
				amount: -4800,
				currency: "EUR",
				vat: 19,
				credit_type: "debit",
				debit_postingaccount_number: "6300",
				credit_postingaccount_number: "1200",
				cost_location: "161",
				cost_location_two: "5",
				transaction_amount: -4800,
				transaction_purpose: "Venue deposit",
			},
			scope_amount: -4800,
			allocations: [],
			matches: [],
			matched_amount: 3000,
			unmatched_amount: 1800,
			overmatched_amount: 0,
		},
	],
	unplanned_postings: [],
	source: "mock",
	generated_at: "2026-07-21T12:00:00.000Z",
};

const requests: FinanceReallocationRequest[] = [
	{
		id: REQUEST_ID,
		posting_external_id: "BB-1",
		requesting_department: "Makeathon",
		reason: "Move the venue cost to the event",
		status: "pending",
		requested_by: "user-1",
		reviewed_by: null,
		review_note: null,
		reviewed_at: null,
		allocations: [
			{
				id: ALLOCATION_ID,
				posting_external_id: "BB-1",
				department: "Makeathon",
				project_id: PROJECT_ID,
				tax_area: "wirtschaftlich",
				allocated_amount: -4800,
				allocated_percentage: 100,
				note: null,
				created_by: "user-1",
				created_at: "2026-07-21T12:00:00.000Z",
				updated_at: "2026-07-21T12:00:00.000Z",
			},
		],
		created_at: "2026-07-21T12:00:00.000Z",
		updated_at: "2026-07-21T12:00:00.000Z",
	},
];

function props() {
	return {
		period: { type: "year" as const, key: "2026" },
		projects,
		planItems,
		selectedProjectId: null,
		reconciliation,
		reallocationRequests: requests,
		department: "Makeathon",
		canManage: false,
		isLoading: false,
		error: null,
		pendingAllocationExternalId: null,
		pendingReallocationExternalId: null,
		pendingMatchExternalId: null,
		deletingMatchId: null,
		reviewingRequestId: null,
		onPeriodTypeChange: vi.fn(),
		onPeriodKeyChange: vi.fn(),
		onProjectChange: vi.fn(),
		onAllocateToProject: vi.fn().mockResolvedValue(undefined),
		onSplitAllocation: vi.fn().mockResolvedValue(undefined),
		onCreateReallocation: vi.fn().mockResolvedValue(undefined),
		onReviewReallocation: vi.fn().mockResolvedValue(undefined),
		onMatchPlanItem: vi.fn().mockResolvedValue(undefined),
		onDeleteMatch: vi.fn().mockResolvedValue(undefined),
	};
}

describe("FinanceReconciliationSection", () => {
	it("matches a posting and submits a department reallocation request", async () => {
		const user = userEvent.setup();
		const sectionProps = props();
		renderWithClient(<FinanceReconciliationSection {...sectionProps} />);

		await user.click(screen.getByRole("button", { name: /Makeathon venue/ }));
		await user.click(screen.getByLabelText("Match plan item"));
		await user.click(await screen.findByRole("option", { name: /Venue/ }));
		await user.click(screen.getByRole("button", { name: "Match" }));

		expect(sectionProps.onMatchPlanItem).toHaveBeenCalledWith({
			plan_item_id: PLAN_ITEM_ID,
			posting_external_id: "BB-1",
			matched_amount: 1800,
			match_type: "manual",
		});

		await user.type(
			screen.getByLabelText("Reason *"),
			"Charge the complete venue to Makeathon",
		);
		await user.click(screen.getByRole("button", { name: "Submit request" }));

		expect(sectionProps.onCreateReallocation).toHaveBeenCalledWith(
			expect.objectContaining({
				posting_external_id: "BB-1",
				requesting_department: "Makeathon",
				reason: "Charge the complete venue to Makeathon",
				allocations: [
					expect.objectContaining({
						department: "Makeathon",
						percentage: 100,
					}),
				],
			}),
		);
	});

	it("shows overmatched postings as errors without further matching controls", async () => {
		const user = userEvent.setup();
		const sectionProps = props();
		const overmatchedRow = {
			...reconciliation.unmatched_postings[0],
			matched_amount: 5000,
			unmatched_amount: 0,
			overmatched_amount: 200,
		};
		renderWithClient(
			<FinanceReconciliationSection
				{...sectionProps}
				reconciliation={{
					...reconciliation,
					unmatched_postings: [overmatchedRow],
				}}
			/>,
		);

		expect(screen.getByText("Overmatched 200,00 €")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /Makeathon venue/ }));
		expect(screen.getByRole("alert")).toHaveTextContent(
			"The matched plan amount exceeds this posting share by 200,00 €",
		);
		expect(screen.queryByLabelText("Match plan item")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Match" }),
		).not.toBeInTheDocument();
	});

	it("lets reviewers allocate postings and approve requests", async () => {
		const user = userEvent.setup();
		const sectionProps = { ...props(), canManage: true, department: null };
		renderWithClient(<FinanceReconciliationSection {...sectionProps} />);

		await user.click(screen.getByRole("button", { name: /Makeathon venue/ }));
		await user.click(screen.getByLabelText("Project for full allocation"));
		await user.click(
			await screen.findByRole("option", { name: /Makeathon 2026/ }),
		);
		await user.click(screen.getByRole("button", { name: "Allocate fully" }));
		expect(sectionProps.onAllocateToProject).toHaveBeenCalledWith({
			postingExternalId: "BB-1",
			projectId: PROJECT_ID,
		});

		await user.type(
			screen.getByLabelText("Review note for Makeathon"),
			"Confirmed",
		);
		await user.click(screen.getByRole("button", { name: "Approve" }));
		expect(sectionProps.onReviewReallocation).toHaveBeenCalledWith({
			requestId: REQUEST_ID,
			review: { decision: "approved", review_note: "Confirmed" },
		});
	});
});
