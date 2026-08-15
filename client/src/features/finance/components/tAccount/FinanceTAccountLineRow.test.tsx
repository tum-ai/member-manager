import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	tAccountDisplayLine,
	tAccountLine,
	tAccountPlanDetail,
	tAccountPostingDetail,
} from "@/features/finance/financeTAccountFixtures";
import type { FinanceTAccountLine } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceTAccountLineRow } from "./FinanceTAccountLineRow";
import type { TAccountInteraction } from "./tAccountInteraction";

function interaction(
	overrides: Partial<TAccountInteraction> = {},
): TAccountInteraction {
	return {
		canWrite: true,
		isSelected: () => false,
		onToggleSelect: vi.fn(),
		onEditSplit: vi.fn(),
		onRequestReallocation: vi.fn(),
		onAssignPosting: vi.fn(),
		onCreateProject: vi.fn(),
		onDeleteProject: vi.fn(),
		onCreatePlanItem: vi.fn(),
		onEditPlanItem: vi.fn(),
		onTogglePlanItem: vi.fn(),
		onCorrectPlanToActual: vi.fn(),
		onMatchFromPlanItem: vi.fn(),
		onMatchFromPosting: vi.fn(),
		onDetachMatch: vi.fn(),
		onDeletePlanItem: vi.fn(),
		...overrides,
	};
}

function renderRow(line: FinanceTAccountLine, actions?: TAccountInteraction) {
	const display = tAccountDisplayLine(line);
	renderWithClient(
		<FinanceTAccountLineRow line={display} interaction={actions} />,
	);
	return display;
}

const booked = tAccountLine({
	label: "Catering Kickoff",
	category: "Verpflegung",
	amount: 119,
	vat_amount: 19,
	vat_rate: 19,
	posting_external_id: "BB-1",
	posting_detail: tAccountPostingDetail({ posting_amount: -119 }),
});

describe("FinanceTAccountLineRow", () => {
	it("renders the label, category and amount", () => {
		renderRow(booked);

		expect(screen.getByText("Catering Kickoff")).toBeInTheDocument();
		expect(screen.getByText("· Verpflegung")).toBeInTheDocument();
		expect(screen.getByText(/119,00/)).toBeInTheDocument();
	});

	// FR-N1/N4: in gross mode the VAT sits inside the number shown, so it reads
	// "inkl."; in net mode it comes on top of it.
	it("states the embedded VAT as included in gross mode", () => {
		renderRow(booked);

		expect(screen.getByText(/inkl\./)).toBeInTheDocument();
		expect(screen.getByText(/Vorsteuer/)).toBeInTheDocument();
	});

	it("omits the VAT note when there is no VAT", () => {
		renderRow(
			tAccountLine({
				label: "Spende",
				amount: 500,
				vat_amount: null,
				posting_external_id: "BB-2",
				posting_detail: tAccountPostingDetail({ posting_amount: -500 }),
			}),
		);

		expect(screen.queryByText(/inkl\./)).not.toBeInTheDocument();
	});

	it("marks a planned line with its badge", () => {
		renderRow(
			tAccountLine({
				kind: "plan",
				label: "Venue-Miete",
				amount: 3570,
				plan_item_id: "plan-venue",
			}),
		);

		expect(screen.getByText("Geplant")).toBeInTheDocument();
	});

	it("marks a parked Planposten as disabled", () => {
		renderRow(
			tAccountLine({
				kind: "plan",
				label: "Venue-Miete",
				amount: 3570,
				plan_item_id: "plan-venue",
				plan_detail: tAccountPlanDetail({
					planned_amount: 3570,
					is_active: false,
				}),
			}),
		);

		expect(screen.getByText("Deaktiviert")).toBeInTheDocument();
	});

	// A rolled-up child-project folder line has no detail of its own, so it is
	// static rather than expandable — the child renders as its own node below.
	it("renders a roll-up line without a disclosure", () => {
		renderRow(
			tAccountLine({
				label: "Unterprojekt",
				amount: 1000,
				posting_detail: null,
				plan_detail: null,
			}),
		);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("expands a booked line to its detail in place", async () => {
		renderRow(booked, interaction());

		expect(screen.queryByText("Buchungsdatum")).not.toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: /Catering Kickoff/ }),
		);
		expect(screen.getByText("Buchungsdatum")).toBeInTheDocument();
	});

	it("expands a planned line to its plan detail", async () => {
		renderRow(
			tAccountLine({
				kind: "plan",
				label: "Venue-Miete",
				amount: 3570,
				plan_item_id: "plan-venue",
			}),
			interaction(),
		);

		await userEvent.click(screen.getByRole("button", { name: /Venue-Miete/ }));

		expect(screen.getByText("Plan")).toBeInTheDocument();
		expect(screen.getByText("Delta")).toBeInTheDocument();
	});

	// FR-K1/K6: only booked invoices are selectable, and only for a writer.
	it("offers a checkbox for a writable booked line", async () => {
		const actions = interaction();
		renderRow(booked, actions);

		await userEvent.click(
			screen.getByRole("checkbox", { name: "Catering Kickoff auswählen" }),
		);

		expect(actions.onToggleSelect).toHaveBeenCalledWith("BB-1");
	});

	it("reflects a line that is already selected", () => {
		renderRow(booked, interaction({ isSelected: () => true }));

		expect(
			screen.getByRole("checkbox", { name: "Catering Kickoff auswählen" }),
		).toBeChecked();
	});

	it("withholds the checkbox from a read-only viewer", () => {
		renderRow(booked, interaction({ canWrite: false }));

		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		// The disclosure still works — read-only means no writes, not no detail.
		expect(
			screen.getByRole("button", { name: /Catering Kickoff/ }),
		).toBeInTheDocument();
	});

	it("withholds the checkbox with no interaction at all", () => {
		renderRow(booked);

		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
	});

	// A Planposten is not an invoice, so it is never selectable.
	it("withholds the checkbox from a planned line", () => {
		renderRow(
			tAccountLine({
				kind: "plan",
				label: "Venue-Miete",
				amount: 3570,
				plan_item_id: "plan-venue",
			}),
			interaction(),
		);

		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
	});
});
