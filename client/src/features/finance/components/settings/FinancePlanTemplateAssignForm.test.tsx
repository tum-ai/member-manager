import type {
	FinancePlanTemplate,
	FinanceProject,
} from "@member-manager/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { renderWithClient } from "@/test/renderWithClient";
import { FinancePlanTemplateAssignForm } from "./FinancePlanTemplateAssignForm";

const period: FinancePeriod = { type: "year", key: "2026" };

const project: FinanceProject = {
	id: "22222222-2222-4222-8222-222222222222",
	name: "Hackathon",
	parent_project_id: null,
	sub_team: null,
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	tax_area: "ideell",
	target_amount: 5000,
	status: "active",
	description: null,
	created_at: "2026-03-01T09:00:00.000Z",
	updated_at: "2026-03-01T09:00:00.000Z",
};

function template(
	overrides: Partial<FinancePlanTemplate> = {},
): FinancePlanTemplate {
	return {
		id: "33333333-3333-4333-8333-333333333333",
		name: "Standard-Event",
		description: null,
		tax_area: null,
		is_active: true,
		items: [],
		created_at: "2026-03-01T09:00:00.000Z",
		updated_at: "2026-03-01T09:00:00.000Z",
		...overrides,
	};
}

function renderForm(
	overrides: {
		projects?: FinanceProject[];
		templates?: FinancePlanTemplate[];
		pendingProjectId?: string | null;
	} = {},
) {
	const onAssign = vi.fn().mockResolvedValue(undefined);
	renderWithClient(
		<FinancePlanTemplateAssignForm
			period={period}
			projects={overrides.projects ?? [project]}
			templates={overrides.templates ?? [template()]}
			pendingProjectId={overrides.pendingProjectId ?? null}
			onAssign={onAssign}
		/>,
	);
	return { onAssign };
}

describe("FinancePlanTemplateAssignForm", () => {
	it("names the period it will fill", () => {
		renderForm();

		expect(
			screen.getByRole("heading", { name: "Vorlage auf Projekt anwenden" }),
		).toBeInTheDocument();
		expect(screen.getByText(/2026/)).toBeInTheDocument();
	});

	// Projects are created in the T-view now, so this form only ever fills one.
	it("points at the T-Konto when no project exists yet", () => {
		renderForm({ projects: [] });

		expect(
			screen.getByText(/Projekte werden im\s+T-Konto angelegt/),
		).toBeInTheDocument();
	});

	it("keeps the submit disabled until both sides are picked", async () => {
		renderForm();

		expect(screen.getByRole("button", { name: "Anwenden" })).toBeDisabled();

		await userEvent.click(screen.getByRole("combobox", { name: "Projekt" }));
		await userEvent.click(screen.getByRole("option", { name: /Hackathon/ }));

		// A project alone is not enough.
		expect(screen.getByRole("button", { name: "Anwenden" })).toBeDisabled();

		await userEvent.click(screen.getByRole("combobox", { name: "Vorlage" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Standard-Event" }),
		);

		expect(screen.getByRole("button", { name: "Anwenden" })).toBeEnabled();
	});

	it("applies the picked template to the picked project", async () => {
		const { onAssign } = renderForm();

		await userEvent.click(screen.getByRole("combobox", { name: "Projekt" }));
		await userEvent.click(screen.getByRole("option", { name: /Hackathon/ }));
		await userEvent.click(screen.getByRole("combobox", { name: "Vorlage" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Standard-Event" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Anwenden" }));

		expect(onAssign).toHaveBeenCalledWith(project.id, template().id);
	});

	// A retired template must not be offered for new work.
	it("offers only active templates", async () => {
		renderForm({
			templates: [
				template(),
				template({
					id: "44444444-4444-4444-8444-444444444444",
					name: "Altes Format",
					is_active: false,
				}),
			],
		});

		await userEvent.click(screen.getByRole("combobox", { name: "Vorlage" }));

		expect(
			screen.getByRole("option", { name: "Standard-Event" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Altes Format" }),
		).not.toBeInTheDocument();
	});

	it("blocks the submit while that project's assignment is in flight", async () => {
		renderForm({ pendingProjectId: project.id });

		await userEvent.click(screen.getByRole("combobox", { name: "Projekt" }));
		await userEvent.click(screen.getByRole("option", { name: /Hackathon/ }));
		await userEvent.click(screen.getByRole("combobox", { name: "Vorlage" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Standard-Event" }),
		);

		expect(screen.getByRole("button", { name: "Anwenden" })).toBeDisabled();
	});
});
