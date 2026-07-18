import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinanceCategoryMappingRow } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { CategoryMappingEditorSection } from "./CategoryMappingEditorSection";

function row(
	overrides: Partial<FinanceCategoryMappingRow> &
		Pick<FinanceCategoryMappingRow, "cost_location_two">,
): FinanceCategoryMappingRow {
	return {
		label: null,
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
	savingCostLocationTwo: null,
};

describe("CategoryMappingEditorSection", () => {
	it("marks unlabelled cost locations and counts them", () => {
		renderWithClient(
			<CategoryMappingEditorSection
				{...baseProps}
				rows={[
					row({ cost_location_two: "1" }),
					row({ cost_location_two: "5", label: "Software" }),
				]}
				onSave={vi.fn()}
			/>,
		);

		expect(screen.getAllByText("Ohne Kategorie").length).toBeGreaterThan(0);
		expect(
			screen.getByText(/1 von 2 Kostenstellen haben noch keine Kategorie/),
		).toBeInTheDocument();
	});

	it("saves a new label on blur", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<CategoryMappingEditorSection
				{...baseProps}
				rows={[row({ cost_location_two: "1" })]}
				onSave={onSave}
			/>,
		);

		const input = screen.getByLabelText("Kategorie für Kostenstelle 2 1");
		await user.type(input, "Catering");
		await user.tab();

		expect(onSave).toHaveBeenCalledWith({
			costLocationTwo: "1",
			label: "Catering",
		});
	});

	it("does not save when the label is unchanged", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<CategoryMappingEditorSection
				{...baseProps}
				rows={[row({ cost_location_two: "5", label: "Software" })]}
				onSave={onSave}
			/>,
		);

		// Focus and blur without editing.
		await user.click(screen.getByLabelText("Kategorie für Kostenstelle 2 5"));
		await user.tab();

		expect(onSave).not.toHaveBeenCalled();
	});
});
