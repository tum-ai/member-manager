import type {
	FinancePlanItem,
	FinanceProject,
	FinanceReallocationRequest,
	FinanceReconciliationResponse,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FinanceReconciliationSection } from "./FinanceReconciliationSection";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const PLAN_ITEM_ID = "20000000-0000-4000-8000-000000000001";
const REQUEST_ID = "30000000-0000-4000-8000-000000000001";

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

const reallocationRequests: FinanceReallocationRequest[] = [
	{
		id: REQUEST_ID,
		posting_external_id: "BB-2",
		requesting_department: "Makeathon",
		reason: "Move the catering cost to the event",
		status: "pending",
		requested_by: "user-1",
		reviewed_by: null,
		review_note: null,
		reviewed_at: null,
		allocations: [],
		created_at: "2026-07-21T12:00:00.000Z",
		updated_at: "2026-07-21T12:00:00.000Z",
	},
];

const meta = {
	title: "Features/Finance/FinanceReconciliationSection",
	component: FinanceReconciliationSection,
	parameters: { layout: "padded" },
	args: {
		period: { type: "year", key: "2026" },
		projects,
		planItems,
		selectedProjectId: null,
		reconciliation,
		reallocationRequests,
		department: "Makeathon",
		canManage: false,
		isLoading: false,
		error: null,
		pendingAllocationExternalId: null,
		pendingReallocationExternalId: null,
		pendingMatchExternalId: null,
		deletingMatchId: null,
		reviewingRequestId: null,
		onPeriodTypeChange: fn(),
		onPeriodKeyChange: fn(),
		onProjectChange: fn(),
		onAllocateToProject: fn(async () => undefined),
		onSplitAllocation: fn(async () => undefined),
		onCreateReallocation: fn(async () => undefined),
		onReviewReallocation: fn(async () => undefined),
		onMatchPlanItem: fn(async () => undefined),
		onDeleteMatch: fn(async () => undefined),
	},
} satisfies Meta<typeof FinanceReconciliationSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DepartmentWorkflow: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: /Makeathon venue/ }),
		);
		await expect(canvas.getByLabelText("Match plan item")).toBeVisible();
		await expect(canvas.getByLabelText("Reason *")).toBeVisible();
	},
};

export const ReviewerWorkflow: Story = {
	args: {
		canManage: true,
		department: null,
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			canvas.getByLabelText("Review note for Makeathon"),
			"Confirmed",
		);
		await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
		await expect(args.onReviewReallocation).toHaveBeenCalledWith({
			requestId: REQUEST_ID,
			review: { decision: "approved", review_note: "Confirmed" },
		});
	},
};

export const OvermatchedPosting: Story = {
	args: {
		reconciliation: {
			...reconciliation,
			unmatched_postings: [
				{
					...reconciliation.unmatched_postings[0],
					matched_amount: 5000,
					unmatched_amount: 0,
					overmatched_amount: 200,
				},
			],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Overmatched 200,00 €")).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: /Makeathon venue/ }),
		);
		await expect(canvas.getByRole("alert")).toBeVisible();
		await expect(
			canvas.queryByLabelText("Match plan item"),
		).not.toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: {
		reconciliation: undefined,
		reallocationRequests: [],
		isLoading: true,
	},
};
