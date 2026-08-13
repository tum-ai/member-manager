import type {
	FinanceBudgetTransferRequest,
	FinanceReallocationRequest,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { FinanceApprovalsSection } from "./FinanceApprovalsSection";

const period: FinancePeriod = { type: "year", key: "2026" };

const reallocation: FinanceReallocationRequest = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	posting_external_id: "BB-1042",
	requesting_department: "Makeathon",
	reason: "Gehört zur Community-Onboarding-Woche, nicht zu uns.",
	status: "pending",
	requested_by: "user-1",
	reviewed_by: null,
	review_note: null,
	reviewed_at: null,
	allocations: [],
	created_at: "2026-08-01T10:00:00.000Z",
	updated_at: "2026-08-01T10:00:00.000Z",
};

const budgetTransfer: FinanceBudgetTransferRequest = {
	id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	source_department: "Makeathon",
	target_department: "Community",
	period_type: "year",
	period_key: "2026",
	amount: 250,
	reason: "Nicht verbrauchtes Venue-Budget abgeben.",
	status: "pending",
	requested_by: "user-1",
	reviewed_by: null,
	review_note: null,
	reviewed_at: null,
	created_at: "2026-08-01T10:00:00.000Z",
	updated_at: "2026-08-01T10:00:00.000Z",
};

const meta = {
	title: "Features/Finance/FinanceApprovalsSection",
	component: FinanceApprovalsSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof FinanceApprovalsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs = {
	period,
	department: "Legal & Finance",
	canManage: true,
	error: null,
	reviewingRequestId: null,
	pendingBudgetTransfer: false,
	reviewingBudgetTransferId: null,
	onPeriodTypeChange: fn(),
	onPeriodKeyChange: fn(),
	onReviewReallocation: fn(),
	onCreateBudgetTransfer: fn(),
	onReviewBudgetTransfer: fn(),
};

// The inbox as LnF sees it: both kinds of request in one place, with the open
// count stated up front (FR-O).
export const OpenRequests: Story = {
	args: {
		...baseArgs,
		reallocationRequests: [reallocation],
		budgetTransferRequests: [budgetTransfer],
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		// Both queues also use the word "Offen" for their own status badges, so
		// the header count is addressed through its landmark.
		const header = canvas.getByRole("region", { name: "Anträge" });
		await expect(within(header).getByText("Offen")).toBeVisible();
		await expect(within(header).getByText("2")).toBeVisible();
		await expect(
			canvas.getByText(/Gehört zur Community-Onboarding-Woche/),
		).toBeVisible();
		await expect(
			canvas.getByText(/Nicht verbrauchtes Venue-Budget/),
		).toBeVisible();

		// Each queue reviews its own kind, so the button is addressed through the
		// section it belongs to rather than by position.
		const transfers = canvas.getByRole("region", {
			name: "Budgetübertragungen",
		});
		await userEvent.click(
			within(transfers).getByRole("button", { name: "Genehmigen" }),
		);
		await expect(args.onReviewBudgetTransfer).toHaveBeenCalled();
	},
};

// Nothing to do is a state worth saying out loud, rather than an empty page.
export const Empty: Story = {
	args: {
		...baseArgs,
		reallocationRequests: [],
		budgetTransferRequests: [],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Keine offenen Anträge.")).toBeVisible();
	},
};

// A department member raises transfers here but reviews nothing.
export const DepartmentMember: Story = {
	args: {
		...baseArgs,
		canManage: false,
		department: "Makeathon",
		reallocationRequests: [reallocation],
		budgetTransferRequests: [budgetTransfer],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("button", { name: "Genehmigen" }),
		).toBeNull();
	},
};
