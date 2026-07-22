import type {
	FinancePlanTemplate,
	FinanceProject,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FinanceProjectsSection } from "./FinanceProjectsSection";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const TEMPLATE_ID = "20000000-0000-4000-8000-000000000001";

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
		description: "Annual flagship event",
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	},
];

const templates: FinancePlanTemplate[] = [
	{
		id: TEMPLATE_ID,
		name: "Event baseline",
		description: "Core event costs",
		tax_area: "wirtschaftlich",
		is_active: true,
		items: [
			{
				id: "30000000-0000-4000-8000-000000000001",
				template_id: TEMPLATE_ID,
				label: "Venue",
				category: "Location",
				planned_amount: 5000,
				expected_month: "2026-05",
				note: null,
				sort_order: 0,
			},
			{
				id: "30000000-0000-4000-8000-000000000002",
				template_id: TEMPLATE_ID,
				label: "Catering",
				category: "Food",
				planned_amount: 1800,
				expected_month: "2026-05",
				note: null,
				sort_order: 1,
			},
		],
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	},
];

const meta = {
	title: "Features/Finance/FinanceProjectsSection",
	component: FinanceProjectsSection,
	parameters: { layout: "padded" },
	args: {
		period: { type: "year", key: "2026" },
		projects,
		templates,
		department: "Makeathon",
		canManage: false,
		isLoading: false,
		error: null,
		isCreatingProject: false,
		isCreatingTemplate: false,
		pendingTemplateItemId: null,
		pendingAssignmentProjectId: null,
		deletingTemplateItemId: null,
		onPeriodTypeChange: fn(),
		onPeriodKeyChange: fn(),
		onCreateProject: fn(async () => undefined),
		onCreateTemplate: fn(async () => undefined),
		onCreateTemplateItem: fn(async () => undefined),
		onDeleteTemplateItem: fn(async () => undefined),
		onAssignTemplate: fn(async () => undefined),
	},
} satisfies Meta<typeof FinanceProjectsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DepartmentView: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.type(canvas.getByLabelText("Name *"), "Venue operations");
		await userEvent.click(canvas.getByLabelText("Übergeordnetes Projekt"));
		await userEvent.click(
			await body.findByRole("option", { name: "Makeathon 2026" }),
		);
		await userEvent.clear(canvas.getByLabelText("Zielbetrag (€) *"));
		await userEvent.type(canvas.getByLabelText("Zielbetrag (€) *"), "-5000");
		await userEvent.click(
			canvas.getByRole("button", { name: "Projekt anlegen" }),
		);

		await expect(args.onCreateProject).toHaveBeenCalledWith(
			expect.objectContaining({
				parent_project_id: PROJECT_ID,
				target_amount: -5000,
			}),
		);
	},
};

export const ReviewerManagement: Story = {
	args: {
		canManage: true,
		department: null,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText("Projekt-Department")).toBeVisible();
		await expect(canvas.getByLabelText("Neue Vorlage")).toBeVisible();
	},
};

export const Loading: Story = {
	args: {
		projects: [],
		templates: [],
		isLoading: true,
	},
};
