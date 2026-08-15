import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	tAccountDisplayLine,
	tAccountLine,
	tAccountMatch,
	tAccountPlanDetail,
} from "@/features/finance/financeTAccountFixtures";
import type {
	FinanceTAccountLine,
	FinanceTAccountPlanDetail,
} from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinancePlanItemDetailPanel } from "./FinancePlanItemDetailPanel";
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

function planned(
	detail: Partial<FinanceTAccountPlanDetail> = {},
	overrides: Partial<FinanceTAccountLine> = {},
) {
	return tAccountLine({
		kind: "plan",
		label: "Venue-Miete",
		category: "Location",
		amount: 3570,
		plan_item_id: "plan-venue",
		plan_detail: tAccountPlanDetail({
			planned_amount: 3570,
			...detail,
		}),
		...overrides,
	});
}

function renderPanel(
	line: FinanceTAccountLine,
	options: {
		extraLines?: FinanceTAccountLine[];
		interaction?: TAccountInteraction;
	} = {},
) {
	const display = tAccountDisplayLine(line, options.extraLines);
	renderWithClient(
		<FinancePlanItemDetailPanel
			line={display}
			detail={display.planDetail ?? tAccountPlanDetail()}
			interaction={options.interaction}
		/>,
	);
	return display;
}

describe("FinancePlanItemDetailPanel", () => {
	it("states the Planposten's plan, actual and delta", () => {
		renderPanel(
			planned({ planned_amount: 3570, matched_amount: 2380, delta: -1190 }),
		);

		expect(screen.getByText("Plan")).toBeInTheDocument();
		expect(screen.getByText("Ist")).toBeInTheDocument();
		expect(screen.getByText("Delta")).toBeInTheDocument();
		expect(screen.getByText(/3\.570,00/)).toBeInTheDocument();
		expect(screen.getByText(/2\.380,00/)).toBeInTheDocument();
	});

	it("defaults the status badge to planned", () => {
		renderPanel(planned());

		expect(screen.getByText("Geplant")).toBeInTheDocument();
	});

	it("names the status it was given", () => {
		renderPanel(planned({}, { status: "committed" }));

		expect(screen.getByText("Zugesagt")).toBeInTheDocument();
	});

	it("shows the expected month and note when set", () => {
		renderPanel(planned({ expected_month: "2026-05", note: "Vertrag folgt." }));

		expect(screen.getByText("May 2026")).toBeInTheDocument();
		expect(screen.getByText("Vertrag folgt.")).toBeInTheDocument();
	});

	// A planned VAT rate that was never set is unknown, not zero (FR-N5).
	it("renders an unset rate as an em dash", () => {
		renderPanel(planned({ vat_rate: null }));

		expect(screen.getAllByText("—").length).toBeGreaterThan(0);
	});

	it("states the planned VAT with its side of the ledger", () => {
		renderPanel(planned({ vat_rate: 19 }, { vat_amount: 190, vat_rate: 19 }));

		expect(screen.getByText("19 %")).toBeInTheDocument();
		expect(screen.getByText("Vorsteuer (geplant)")).toBeInTheDocument();
	});

	it("names output tax on a planned income line", () => {
		renderPanel(
			planned({ vat_rate: 19 }, { direction: "income", vat_rate: 19 }),
		);

		expect(screen.getByText("Umsatzsteuer (geplant)")).toBeInTheDocument();
	});

	// FR-M3: a parked Planposten still renders, flagged as parked.
	it("flags a disabled Planposten", () => {
		renderPanel(planned({ is_active: false }), {
			interaction: interaction(),
		});

		expect(screen.getByText("Deaktiviert")).toBeInTheDocument();
		// Matching a parked item is refused server-side, so it isn't offered.
		expect(
			screen.queryByRole("button", { name: "Buchung zuordnen" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Aktivieren" }),
		).toBeInTheDocument();
	});

	it("offers no actions to a read-only viewer", () => {
		renderPanel(planned(), {
			interaction: interaction({ canWrite: false }),
		});

		expect(
			screen.queryByRole("button", { name: "Bearbeiten" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Löschen" }),
		).not.toBeInTheDocument();
	});

	it("edits, matches and parks an active Planposten", async () => {
		const actions = interaction();
		const display = renderPanel(planned(), { interaction: actions });

		await userEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Buchung zuordnen" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Deaktivieren" }));

		expect(actions.onEditPlanItem).toHaveBeenCalledWith(display);
		expect(actions.onMatchFromPlanItem).toHaveBeenCalledWith(display);
		expect(actions.onTogglePlanItem).toHaveBeenCalledWith("plan-venue", false);
	});

	// FR-M6: correcting only makes sense once money arrived and the two disagree.
	it("offers the plan-to-actual correction only when they disagree", async () => {
		const actions = interaction();
		renderPanel(planned({ matched_amount: 2380, delta: -1190 }), {
			interaction: actions,
		});

		await userEvent.click(
			screen.getByRole("button", { name: "Plan auf Ist korrigieren" }),
		);

		expect(actions.onCorrectPlanToActual).toHaveBeenCalledWith(
			"plan-venue",
			2380,
		);
	});

	it("hides the correction while nothing has arrived", () => {
		renderPanel(planned({ matched_amount: 0, delta: 0 }), {
			interaction: interaction(),
		});

		expect(
			screen.queryByRole("button", { name: "Plan auf Ist korrigieren" }),
		).not.toBeInTheDocument();
	});

	it("hides the correction when plan and actual already agree", () => {
		renderPanel(planned({ matched_amount: 3570, delta: 0 }), {
			interaction: interaction(),
		});

		expect(
			screen.queryByRole("button", { name: "Plan auf Ist korrigieren" }),
		).not.toBeInTheDocument();
	});

	// FR-M7: money that already arrived is detached deliberately, not deleted out
	// from under.
	it("offers deletion only while nothing is matched", async () => {
		const actions = interaction();
		renderPanel(planned(), { interaction: actions });

		await userEvent.click(screen.getByRole("button", { name: "Löschen" }));

		expect(actions.onDeletePlanItem).toHaveBeenCalledWith(
			"plan-venue",
			"Venue-Miete",
		);
	});

	it("withholds deletion once a booking is matched", () => {
		renderPanel(planned({ matched_amount: 2380, delta: -1190 }), {
			interaction: interaction(),
		});

		expect(
			screen.queryByRole("button", { name: "Löschen" }),
		).not.toBeInTheDocument();
	});

	it("reports when no booking is matched yet", () => {
		renderPanel(planned());

		expect(
			screen.getByText("Noch keine Buchung zugeordnet."),
		).toBeInTheDocument();
	});

	it("resolves a matched booking to its label and detaches it", async () => {
		const actions = interaction();
		renderPanel(
			planned({
				matched_amount: 2380,
				delta: -1190,
				matches: [
					tAccountMatch({
						id: "match-3",
						plan_item_id: "plan-venue",
						posting_external_id: "BB-9",
						matched_amount: 2380,
					}),
				],
			}),
			{
				extraLines: [
					tAccountLine({
						label: "Hallenmiete",
						amount: 2380,
						posting_external_id: "BB-9",
					}),
				],
				interaction: actions,
			},
		);

		expect(screen.getByText("Hallenmiete")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: /entfernen/ }));
		expect(actions.onDetachMatch).toHaveBeenCalledOnce();
	});
});
