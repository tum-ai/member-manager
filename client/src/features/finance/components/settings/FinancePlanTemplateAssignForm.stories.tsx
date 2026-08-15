import type {
	FinancePlanTemplate,
	FinanceProject,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { FinancePlanTemplateAssignForm } from "./FinancePlanTemplateAssignForm";

const period: FinancePeriod = { type: "year", key: "2026" };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const projects: FinanceProject[] = [
	{
		id: PROJECT_ID,
		parent_project_id: null,
		name: "Makeathon 2026",
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		tax_area: null,
		target_amount: -5000,
		status: "active",
		description: null,
		sub_team: null,
		created_at: "2026-08-01T10:00:00.000Z",
		updated_at: "2026-08-01T10:00:00.000Z",
	},
];

const templates: FinancePlanTemplate[] = [
	{
		id: "22222222-2222-4222-8222-222222222222",
		name: "Event-Baseline",
		description: null,
		tax_area: null,
		is_active: true,
		items: [],
		created_at: "2026-08-01T10:00:00.000Z",
		updated_at: "2026-08-01T10:00:00.000Z",
	},
	{
		id: "33333333-3333-4333-8333-333333333333",
		name: "Alte Vorlage",
		description: null,
		tax_area: null,
		is_active: false,
		items: [],
		created_at: "2026-08-01T10:00:00.000Z",
		updated_at: "2026-08-01T10:00:00.000Z",
	},
];

const meta = {
	title: "Features/Finance/FinancePlanTemplateAssignForm",
	component: FinancePlanTemplateAssignForm,
	parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof FinancePlanTemplateAssignForm>;

export default meta;

type Story = StoryObj<typeof meta>;

// Applying a template moved here when the project table went away (FR-O).
export const AssignsATemplate: Story = {
	args: {
		period,
		projects,
		templates,
		pendingProjectId: null,
		onAssign: fn(),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole("combobox", { name: "Projekt" }));
		await userEvent.click(
			await within(document.body).findByRole("option", {
				name: /Makeathon 2026/,
			}),
		);
		await userEvent.click(canvas.getByRole("combobox", { name: "Vorlage" }));
		// A retired template is not on offer.
		await expect(
			within(document.body).queryByRole("option", { name: "Alte Vorlage" }),
		).toBeNull();
		await userEvent.click(
			await within(document.body).findByRole("option", {
				name: "Event-Baseline",
			}),
		);
		await userEvent.click(canvas.getByRole("button", { name: /Anwenden/ }));

		await expect(args.onAssign).toHaveBeenCalledWith(
			PROJECT_ID,
			"22222222-2222-4222-8222-222222222222",
		);
	},
};

// Without a project there is nothing to apply to, and the form says where
// projects come from instead of offering an empty picker.
export const NoProjectsYet: Story = {
	args: {
		period,
		projects: [],
		templates,
		pendingProjectId: null,
		onAssign: fn(),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/Projekte werden im T-Konto angelegt/),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: /Anwenden/ }),
		).toBeDisabled();
	},
};
