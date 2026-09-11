import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinanceProject } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import {
	FinanceSplitAllocationDialog,
	type FinanceSplitDialogPreset,
} from "./FinanceSplitAllocationDialog";

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

// A posting that was just imported: the reviewer opened it from the T-account
// and it carries no stored allocation at all.
const unsplit: FinanceSplitDialogPreset = {
	postingExternalId: "BB-1",
	label: "Catering Kickoff",
	hasStoredAllocations: false,
};

function renderDialog(
	overrides: {
		preset?: FinanceSplitDialogPreset | null;
		department?: string | null;
		isPending?: boolean;
	} = {},
) {
	const onClose = vi.fn();
	const onAllocateToProject = vi.fn().mockResolvedValue(undefined);
	const onSplitAllocation = vi.fn().mockResolvedValue(undefined);
	renderWithClient(
		<FinanceSplitAllocationDialog
			preset={overrides.preset === undefined ? unsplit : overrides.preset}
			projects={[project]}
			department={
				overrides.department === undefined ? "Makeathon" : overrides.department
			}
			isPending={overrides.isPending ?? false}
			onClose={onClose}
			onAllocateToProject={onAllocateToProject}
			onSplitAllocation={onSplitAllocation}
		/>,
	);
	return { onClose, onAllocateToProject, onSplitAllocation };
}

// Switch the editor from the 100 %-project fast path to the percentage rows.
async function openSplitMode(): Promise<void> {
	await userEvent.click(
		screen.getByRole("radio", { name: "Prozentuale Aufteilung" }),
	);
}

describe("FinanceSplitAllocationDialog", () => {
	it("stays closed without a preset", () => {
		renderDialog({ preset: null });

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	// The editor is reached for a first split as well as for a later edit
	// (PR #321 review), so it must not claim to replace a split that is not there.
	it("says a posting with no stored allocation gets its first one here", () => {
		renderDialog();

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/hier entsteht die erste/)).toBeInTheDocument();
		expect(
			screen.queryByText(/ersetzt die bestehende Aufteilung/),
		).not.toBeInTheDocument();
	});

	it("warns that it replaces the split of a posting that already has one", () => {
		renderDialog({
			preset: { ...unsplit, hasStoredAllocations: true },
		});

		expect(
			screen.getByText(/ersetzt die bestehende Aufteilung/),
		).toBeInTheDocument();
	});

	// Regression (PR #321 review): the editor is opened for postings with zero or
	// one allocation now, so its starting point has to be usable on its own — one
	// seeded 100 % row on the posting's own department, not an empty form.
	it("opens on a single 100 % row seeded with the department", async () => {
		renderDialog();
		await openSplitMode();

		expect(screen.getByLabelText("Anteil (%)")).toHaveValue(100);
		expect(
			screen.getByRole("combobox", { name: "Department für Aufteilung 1" }),
		).toHaveTextContent("Makeathon");
		// One row cannot be removed — it is the whole posting.
		expect(
			screen.getByRole("button", { name: "Aufteilung 1 entfernen" }),
		).toBeDisabled();
	});

	it("creates a first percentage split from that seeded row", async () => {
		const { onSplitAllocation } = renderDialog();
		await openSplitMode();

		// A second row splits the posting evenly and needs its own target.
		await userEvent.click(
			screen.getByRole("button", { name: "Aufteilung hinzufügen" }),
		);
		await userEvent.click(
			screen.getByRole("combobox", { name: "Department für Aufteilung 2" }),
		);
		await userEvent.click(screen.getByRole("option", { name: "Marketing" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Aufteilung speichern" }),
		);

		expect(onSplitAllocation).toHaveBeenCalledWith({
			postingExternalId: "BB-1",
			allocations: [
				expect.objectContaining({ department: "Makeathon", percentage: 50 }),
				expect.objectContaining({ department: "Marketing", percentage: 50 }),
			],
		});
	});

	it("refuses a split that does not add up to 100 %", async () => {
		const { onSplitAllocation } = renderDialog();
		await openSplitMode();

		// `fireEvent` rather than `userEvent.type`: every edit goes through
		// `useFieldArray.update`, which hands the row a fresh key and remounts the
		// input, so a per-keystroke typist loses the field after the first one.
		fireEvent.change(screen.getByLabelText("Anteil (%)"), {
			target: { value: "40" },
		});
		await userEvent.click(
			screen.getByRole("button", { name: "Aufteilung speichern" }),
		);

		expect(
			await screen.findByText(
				"Die prozentuale Aufteilung muss genau 100 % ergeben.",
			),
		).toBeInTheDocument();
		expect(onSplitAllocation).not.toHaveBeenCalled();
	});

	// The fast path is still the first thing the editor offers: a posting that
	// belongs to one project wholesale does not need percentages at all.
	it("files the whole posting into one project and closes", async () => {
		const { onAllocateToProject, onClose } = renderDialog();

		const dialog = within(screen.getByRole("dialog"));
		await userEvent.click(
			dialog.getByRole("combobox", {
				name: "Projekt für vollständige Zuordnung",
			}),
		);
		await userEvent.click(screen.getByRole("option", { name: /Hackathon/ }));
		await userEvent.click(
			dialog.getByRole("button", { name: "Vollständig zuordnen" }),
		);

		expect(onAllocateToProject).toHaveBeenCalledWith({
			postingExternalId: "BB-1",
			projectId: project.id,
		});
		expect(onClose).toHaveBeenCalled();
	});

	it("blocks both writes while one is in flight", async () => {
		renderDialog({ isPending: true });

		expect(
			screen.getByRole("button", { name: "Vollständig zuordnen" }),
		).toBeDisabled();
		await openSplitMode();
		expect(
			screen.getByRole("button", { name: "Aufteilung speichern" }),
		).toBeDisabled();
	});
});
