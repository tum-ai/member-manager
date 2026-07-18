import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinanceDepartmentMappingRow } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { DepartmentMappingEditorSection } from "./DepartmentMappingEditorSection";

function row(
	overrides: Partial<FinanceDepartmentMappingRow> &
		Pick<FinanceDepartmentMappingRow, "cost_location">,
): FinanceDepartmentMappingRow {
	return {
		department: null,
		bereich: null,
		note: null,
		posting_count: 3,
		net: -120,
		sample_texts: ["Venue", "Catering"],
		...overrides,
	};
}

const baseProps = {
	isLoading: false,
	error: null,
	savingCostLocation: null,
};

describe("DepartmentMappingEditorSection", () => {
	it("marks unassigned cost locations and counts them", () => {
		renderWithClient(
			<DepartmentMappingEditorSection
				{...baseProps}
				rows={[
					row({ cost_location: "161" }),
					row({ cost_location: "120", department: "Partnerships" }),
				]}
				onSave={vi.fn()}
			/>,
		);

		// The unassigned row shows the "Nicht zugeordnet" badge (and its select
		// value), the assigned one does not.
		expect(screen.getAllByText("Nicht zugeordnet").length).toBeGreaterThan(0);
		expect(
			screen.getByText(/1 von 2 Kostenstellen sind noch nicht zugeordnet/),
		).toBeInTheDocument();
	});

	it("auto-saves a new department assignment on selection", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<DepartmentMappingEditorSection
				{...baseProps}
				rows={[row({ cost_location: "161" })]}
				onSave={onSave}
			/>,
		);

		await user.click(
			screen.getByRole("combobox", {
				name: "Department für Kostenstelle 161",
			}),
		);
		await user.click(await screen.findByRole("option", { name: "Makeathon" }));

		expect(onSave).toHaveBeenCalledWith({
			costLocation: "161",
			department: "Makeathon",
			bereich: null,
		});
	});

	it("lets an existing assignment be changed to another department", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<DepartmentMappingEditorSection
				{...baseProps}
				rows={[row({ cost_location: "120", department: "Makeathon" })]}
				onSave={onSave}
			/>,
		);

		await user.click(
			screen.getByRole("combobox", {
				name: "Department für Kostenstelle 120",
			}),
		);
		await user.click(await screen.findByRole("option", { name: "Venture" }));

		expect(onSave).toHaveBeenCalledWith({
			costLocation: "120",
			department: "Venture",
			bereich: null,
		});
	});
});
