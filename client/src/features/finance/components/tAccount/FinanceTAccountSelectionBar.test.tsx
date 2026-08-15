import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceTAccountSelectionBar } from "./FinanceTAccountSelectionBar";

function renderBar(count: number) {
	const onCreateProject = vi.fn();
	const onAssignToProject = vi.fn();
	const onClear = vi.fn();
	renderWithClient(
		<FinanceTAccountSelectionBar
			count={count}
			grossSum={357}
			onCreateProject={onCreateProject}
			onAssignToProject={onAssignToProject}
			onClear={onClear}
		/>,
	);
	return { onCreateProject, onAssignToProject, onClear };
}

describe("FinanceTAccountSelectionBar", () => {
	// The bar appears as soon as one invoice is ticked (FR-K5) — and not before.
	it("renders nothing while nothing is selected", () => {
		renderBar(0);

		expect(screen.queryByRole("region")).not.toBeInTheDocument();
	});

	it("uses the singular for one selected posting", () => {
		renderBar(1);

		expect(screen.getByText("1 Buchung")).toBeInTheDocument();
		expect(screen.getByText(/357,00/)).toBeInTheDocument();
	});

	it("uses the plural for several and names the landmark", () => {
		renderBar(3);

		expect(screen.getByText("3 Buchungen")).toBeInTheDocument();
		expect(screen.getByRole("region", { name: "Auswahl" })).toBeInTheDocument();
	});

	it("wires each action to its button", async () => {
		const { onCreateProject, onAssignToProject, onClear } = renderBar(2);

		await userEvent.click(
			screen.getByRole("button", { name: "Neues Projekt aus Auswahl" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Zu Projekt hinzufügen" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Auswahl aufheben" }),
		);

		expect(onCreateProject).toHaveBeenCalledOnce();
		expect(onAssignToProject).toHaveBeenCalledOnce();
		expect(onClear).toHaveBeenCalledOnce();
	});
});
