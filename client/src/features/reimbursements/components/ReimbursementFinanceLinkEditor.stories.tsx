import type {
	BuchhaltungsButlerTransaction,
	FinancePlanItem,
	FinanceProject,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { ReimbursementFinanceLinkEditor } from "./ReimbursementFinanceLinkEditor";

const project = {
	id: "10000000-0000-4000-8000-000000000001",
	parent_project_id: null,
	name: "Makeathon 2026",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	tax_area: "wirtschaftlich",
	target_amount: 12000,
	status: "active",
	description: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
} satisfies FinanceProject;

const planItem = {
	id: "30000000-0000-4000-8000-000000000001",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	label: "Prototype materials",
	category: null,
	planned_amount: 500,
	expected_month: "2026-05",
	status: "planned",
	note: null,
} satisfies FinancePlanItem;

const request = {
	id: "request-1",
	user_id: "user-1",
	amount: 500,
	date: "2026-05-01",
	description: "Prototype materials",
	department: "Makeathon",
	submission_type: "reimbursement",
	status: "requested",
	approval_status: "approved",
	payment_status: "to_be_paid",
	finance_project_id: project.id,
	finance_plan_item_id: planItem.id,
	bb_posting_external_id: "BB-1001",
} satisfies ReimbursementRequest;

const posting = {
	external_id: "BB-1001",
	date: "2026-05-01",
	postingtext: "Prototype materials",
	amount: -500,
	currency: "EUR",
	vat: 19,
	credit_type: "debit",
	debit_postingaccount_number: "6840",
	credit_postingaccount_number: "1200",
	cost_location: "160",
	cost_location_two: "4",
	transaction_amount: -500,
	transaction_purpose: "Makeathon prototype materials",
} satisfies BuchhaltungsButlerTransaction;

const meta = {
	title: "Features/Reimbursements/ReimbursementFinanceLinkEditor",
	component: ReimbursementFinanceLinkEditor,
	parameters: { layout: "padded" },
	args: {
		request,
		projects: [project],
		planItems: [planItem],
		postings: [posting],
		disabled: false,
		onSave: fn(async () => undefined),
	},
} satisfies Meta<typeof ReimbursementFinanceLinkEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Linked: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await expect(canvas.getByLabelText("Finance plan item")).toHaveTextContent(
			"Prototype materials",
		);
		await userEvent.click(canvas.getByLabelText("Finance project"));
		await userEvent.click(
			await body.findByRole("option", { name: "No project" }),
		);
		await userEvent.click(canvas.getByLabelText("BB posting"));
		await userEvent.click(await body.findByText("No posting"));
		await userEvent.click(canvas.getByRole("button", { name: "Save links" }));

		await expect(args.onSave).toHaveBeenCalledWith(null, null, null);
	},
};
