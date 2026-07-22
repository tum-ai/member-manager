import type {
	FinancePlanTemplate,
	FinanceProject,
} from "@member-manager/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceProjectsSection } from "./FinanceProjectsSection";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const TEMPLATE_ID = "20000000-0000-4000-8000-000000000001";
const TEMPLATE_ITEM_ID = "30000000-0000-4000-8000-000000000001";

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
				id: TEMPLATE_ITEM_ID,
				template_id: TEMPLATE_ID,
				label: "Venue",
				category: "Location",
				planned_amount: 5000,
				expected_month: "2026-05",
				note: null,
				sort_order: 0,
			},
		],
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	},
];

function props() {
	return {
		period: { type: "year" as const, key: "2026" },
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
		onPeriodTypeChange: vi.fn(),
		onPeriodKeyChange: vi.fn(),
		onCreateProject: vi.fn().mockResolvedValue(undefined),
		onCreateTemplate: vi.fn().mockResolvedValue(undefined),
		onCreateTemplateItem: vi.fn().mockResolvedValue(undefined),
		onDeleteTemplateItem: vi.fn().mockResolvedValue(undefined),
		onAssignTemplate: vi.fn().mockResolvedValue(undefined),
	};
}

describe("FinanceProjectsSection", () => {
	it("creates a sub-project with a signed target and applies a template", async () => {
		const user = userEvent.setup();
		const sectionProps = props();
		renderWithClient(<FinanceProjectsSection {...sectionProps} />);

		await user.type(screen.getByLabelText("Name *"), "Venue operations");
		await user.click(screen.getByLabelText("Parent project"));
		await user.click(
			await screen.findByRole("option", { name: "Makeathon 2026" }),
		);
		await user.clear(screen.getByLabelText("Target amount (€) *"));
		await user.type(screen.getByLabelText("Target amount (€) *"), "-5000");
		await user.click(screen.getByRole("button", { name: "Create project" }));

		expect(sectionProps.onCreateProject).toHaveBeenCalledWith(
			expect.objectContaining({
				parent_project_id: PROJECT_ID,
				department: "Makeathon",
				name: "Venue operations",
				target_amount: -5000,
				status: "draft",
			}),
		);

		await user.click(screen.getByLabelText("Template for Makeathon 2026"));
		await user.click(
			await screen.findByRole("option", { name: "Event baseline" }),
		);
		await user.click(
			screen.getByRole("button", {
				name: "Apply template to Makeathon 2026",
			}),
		);
		expect(sectionProps.onAssignTemplate).toHaveBeenCalledWith({
			projectId: PROJECT_ID,
			templateId: TEMPLATE_ID,
		});
	});

	it("creates templates and template items for reviewers", async () => {
		const user = userEvent.setup();
		const sectionProps = { ...props(), canManage: true, department: null };
		renderWithClient(<FinanceProjectsSection {...sectionProps} />);

		await user.type(screen.getByLabelText("New template"), "Workshop");
		await user.click(screen.getByRole("button", { name: "Create" }));
		expect(sectionProps.onCreateTemplate).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Workshop", is_active: true }),
		);

		await user.click(screen.getByRole("button", { name: /Event baseline/ }));
		await user.type(
			screen.getByLabelText("Item", { selector: "input" }),
			"Catering",
		);
		await user.clear(
			screen.getByLabelText("Amount (€)", { selector: "input" }),
		);
		await user.type(
			screen.getByLabelText("Amount (€)", { selector: "input" }),
			"1200",
		);
		const templateItemForm = screen
			.getByLabelText("Item", { selector: "input" })
			.closest("form");
		expect(templateItemForm).not.toBeNull();
		await user.click(
			within(templateItemForm as HTMLFormElement).getByRole("button", {
				name: "Add item",
			}),
		);

		expect(sectionProps.onCreateTemplateItem).toHaveBeenCalledWith({
			templateId: TEMPLATE_ID,
			item: expect.objectContaining({
				label: "Catering",
				planned_amount: 1200,
			}),
		});
	});
});
