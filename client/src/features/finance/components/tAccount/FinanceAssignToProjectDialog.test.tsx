import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinanceProject } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import {
	type FinanceAssignDialogPreset,
	FinanceAssignToProjectDialog,
} from "./FinanceAssignToProjectDialog";

const project: FinanceProject = {
	id: "22222222-2222-4222-8222-222222222222",
	name: "Hackathon",
	parent_project_id: null,
	sub_team: null,
	department: "Makeathon",
	period_type: "semester",
	period_key: "2026-SS",
	tax_area: "ideell",
	target_amount: 5000,
	status: "active",
	description: null,
	created_at: "2026-03-01T09:00:00.000Z",
	updated_at: "2026-03-01T09:00:00.000Z",
};

const preset: FinanceAssignDialogPreset = {
	postingExternalIds: ["BB-1", "BB-2"],
	selectionSum: 357,
};

function renderDialog(
	overrides: {
		preset?: FinanceAssignDialogPreset | null;
		projects?: FinanceProject[];
		isPending?: boolean;
	} = {},
) {
	const onClose = vi.fn();
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	renderWithClient(
		<FinanceAssignToProjectDialog
			preset={overrides.preset === undefined ? preset : overrides.preset}
			projects={overrides.projects ?? [project]}
			isPending={overrides.isPending ?? false}
			onClose={onClose}
			onSubmit={onSubmit}
		/>,
	);
	return { onClose, onSubmit };
}

describe("FinanceAssignToProjectDialog", () => {
	it("stays closed without a preset", () => {
		renderDialog({ preset: null });

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("states how many postings and how much is about to move", () => {
		renderDialog();

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/2 Buchungen über/)).toBeInTheDocument();
		expect(screen.getByText(/357,00/)).toBeInTheDocument();
	});

	it("uses the singular for a single posting", () => {
		renderDialog({
			preset: { postingExternalIds: ["BB-1"], selectionSum: 119 },
		});

		expect(screen.getByText(/1 Buchung über/)).toBeInTheDocument();
	});

	// FR-L2 needs somewhere to file the invoice into; with no project the dialog
	// says so instead of offering an empty picker.
	it("explains that no project exists yet and disables the submit", () => {
		renderDialog({ projects: [] });

		expect(screen.getByText(/gibt es noch kein\s+Projekt/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Zuordnen" })).toBeDisabled();
	});

	it("refuses to submit before a project is picked", async () => {
		const { onSubmit } = renderDialog();

		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Bitte ein Projekt wählen.",
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits the picked project with the whole selection", async () => {
		const { onSubmit } = renderDialog();

		await userEvent.click(screen.getByRole("combobox", { name: "Projekt" }));
		await userEvent.click(screen.getByRole("option", { name: "Hackathon" }));
		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(onSubmit).toHaveBeenCalledWith(project.id, ["BB-1", "BB-2"]);
	});

	it("closes on cancel", async () => {
		const { onClose, onSubmit } = renderDialog();

		await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

		expect(onClose).toHaveBeenCalledOnce();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("blocks the submit while a write is in flight", () => {
		renderDialog({ isPending: true });

		expect(screen.getByRole("button", { name: "Zuordnen" })).toBeDisabled();
	});
});
