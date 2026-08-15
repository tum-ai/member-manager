import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	TACCOUNT_FIXTURE_PROJECT_ID,
	tAccountAllocation,
	tAccountDisplayLine,
	tAccountLine,
	tAccountMatch,
	tAccountPostingDetail,
} from "@/features/finance/financeTAccountFixtures";
import type { FinanceTAccountLine } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinancePostingDetailPanel } from "./FinancePostingDetailPanel";
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

function booked(overrides: Partial<FinanceTAccountLine> = {}) {
	return tAccountLine({
		label: "Catering Kickoff",
		category: "Verpflegung",
		amount: 119,
		vat_amount: 19,
		vat_rate: 19,
		posting_external_id: "BB-1",
		posting_detail: tAccountPostingDetail({
			booking_date: "2026-03-04",
			invoice_number: "RE-2026-0042",
			counterparty: "Kantine München GmbH",
			purpose: "Catering Kickoff",
			posting_amount: -119,
			debit_account: "6840",
			credit_account: "1200",
			account_label: "Werbekosten",
			cost_location: "120",
			sub_team: "Big Makeathon",
		}),
		...overrides,
	});
}

function renderPanel(
	line: FinanceTAccountLine,
	options: {
		extraLines?: FinanceTAccountLine[];
		interaction?: TAccountInteraction;
		onAssignToProject?: () => void;
	} = {},
) {
	const display = tAccountDisplayLine(line, options.extraLines);
	renderWithClient(
		<FinancePostingDetailPanel
			line={display}
			// The panel only ever renders for a line that has one.
			detail={display.postingDetail ?? tAccountPostingDetail()}
			interaction={options.interaction}
			onAssignToProject={options.onAssignToProject}
		/>,
	);
	return display;
}

describe("FinancePostingDetailPanel", () => {
	it("states the booked invoice's fields inline", () => {
		renderPanel(booked());

		expect(screen.getByText("RE-2026-0042")).toBeInTheDocument();
		expect(screen.getByText("Kantine München GmbH")).toBeInTheDocument();
		expect(screen.getByText("04 Mar 2026")).toBeInTheDocument();
		// Debit / credit accounts collapse into one field with their label.
		expect(screen.getByText("6840 / 1200 · Werbekosten")).toBeInTheDocument();
		// Cost location carries the sub-team alongside it.
		expect(screen.getByText("120 · Big Makeathon")).toBeInTheDocument();
		expect(screen.getByText("19 %")).toBeInTheDocument();
		// An expense's VAT is reclaimable input tax, never a generic "USt" (FR-N2).
		expect(screen.getByText("Vorsteuer")).toBeInTheDocument();
	});

	it("names output tax on an income line", () => {
		renderPanel(
			booked({ direction: "income", label: "Sponsoring", amount: 1190 }),
		);

		expect(screen.getByText("Umsatzsteuer")).toBeInTheDocument();
		expect(screen.queryByText("Vorsteuer")).not.toBeInTheDocument();
	});

	// An unknown rate the import never carried is not a zero rate.
	it("renders an unknown VAT rate as an em dash", () => {
		renderPanel(booked({ vat_amount: null, vat_rate: null }));

		expect(screen.getAllByText("—").length).toBeGreaterThan(0);
	});

	it("falls back to em dashes for absent accounts and cost location", () => {
		renderPanel(
			booked({
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					debit_account: null,
					credit_account: null,
					account_label: null,
					cost_location: null,
					sub_team: null,
				}),
			}),
		);

		expect(screen.getByText("— / —")).toBeInTheDocument();
	});

	// `line.amount` is this department's share; `posting_amount` is what the bank
	// booked. On a split posting they differ, and showing both is the point.
	it("shows the department share only when it differs from the booking", () => {
		renderPanel(
			booked({
				amount: 59.5,
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					allocations: [
						tAccountAllocation({
							department: "Makeathon",
							allocated_amount: -59.5,
							allocated_percentage: 50,
						}),
						tAccountAllocation({
							id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
							department: "Marketing",
							allocated_amount: -59.5,
							allocated_percentage: 50,
						}),
					],
				}),
			}),
		);

		expect(screen.getByText("Anteil dieses Departments")).toBeInTheDocument();
	});

	it("hides the department share when the posting is not split", () => {
		renderPanel(booked());

		expect(
			screen.queryByText("Anteil dieses Departments"),
		).not.toBeInTheDocument();
	});

	it("explains an automatic allocation when there is none stored", () => {
		renderPanel(booked());

		expect(
			screen.getByText("Automatische Zuordnung aus der Kostenstelle."),
		).toBeInTheDocument();
	});

	it("lists stored allocations with their share", () => {
		renderPanel(
			booked({
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					allocations: [
						tAccountAllocation({
							department: "Makeathon",
							project_id: TACCOUNT_FIXTURE_PROJECT_ID,
							tax_area: "ideell",
							allocated_amount: -119,
						}),
					],
				}),
			}),
		);

		expect(screen.getByText(/Makeathon · Hackathon/)).toBeInTheDocument();
	});

	it("labels an allocation without a department", () => {
		renderPanel(
			booked({
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					allocations: [tAccountAllocation({ allocated_amount: -119 })],
				}),
			}),
		);

		expect(screen.getByText(/Ohne Department/)).toBeInTheDocument();
	});

	it("reports when no Planposten is linked yet", () => {
		renderPanel(booked());

		expect(
			screen.getByText("Noch kein Planposten verknüpft."),
		).toBeInTheDocument();
	});

	it("resolves a linked Planposten to its label", () => {
		renderPanel(
			booked({
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					matches: [
						tAccountMatch({
							plan_item_id: "plan-catering",
							matched_amount: 119,
						}),
					],
				}),
			}),
			{
				extraLines: [
					tAccountLine({
						kind: "plan",
						label: "Catering (geplant)",
						amount: 81,
						plan_item_id: "plan-catering",
					}),
				],
			},
		);

		expect(screen.getByText("Catering (geplant)")).toBeInTheDocument();
	});

	// FR-K6: a read-only viewer still gets the whole detail, just no actions.
	it("offers no actions without an assign handler", () => {
		renderPanel(booked(), { interaction: interaction({ canWrite: false }) });

		expect(
			screen.queryByRole("button", { name: "Zu Projekt hinzufügen" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /entfernen/ }),
		).not.toBeInTheDocument();
	});

	it("files the invoice, matches it and asks for a reallocation", async () => {
		const onAssignToProject = vi.fn();
		const actions = interaction();
		const display = renderPanel(booked(), {
			interaction: actions,
			onAssignToProject,
		});

		await userEvent.click(
			screen.getByRole("button", { name: "Zu Projekt hinzufügen" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Planposten zuordnen" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Umverteilung beantragen" }),
		);

		expect(onAssignToProject).toHaveBeenCalledOnce();
		expect(actions.onMatchFromPosting).toHaveBeenCalledWith(display);
		expect(actions.onRequestReallocation).toHaveBeenCalledWith(display);
	});

	// A split posting is refused by the fast path and edited here instead (FR-L5).
	it("offers the split editor only for an already-split posting", () => {
		const single = renderPanel(booked(), {
			interaction: interaction(),
			onAssignToProject: vi.fn(),
		});
		expect(single.allocations.length).toBeLessThan(2);
		expect(
			screen.queryByRole("button", { name: "Aufteilung bearbeiten" }),
		).not.toBeInTheDocument();
	});

	it("edits the split of a posting that has one", async () => {
		const actions = interaction();
		const display = renderPanel(
			booked({
				amount: 59.5,
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					allocations: [
						tAccountAllocation({
							department: "Makeathon",
							allocated_amount: -59.5,
							allocated_percentage: 50,
						}),
						tAccountAllocation({
							id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
							department: "Marketing",
							allocated_amount: -59.5,
							allocated_percentage: 50,
						}),
					],
				}),
			}),
			{ interaction: actions, onAssignToProject: vi.fn() },
		);

		await userEvent.click(
			screen.getByRole("button", { name: "Aufteilung bearbeiten" }),
		);

		expect(actions.onEditSplit).toHaveBeenCalledWith(display);
	});

	it("detaches a match for a writer", async () => {
		const actions = interaction();
		renderPanel(
			booked({
				posting_detail: tAccountPostingDetail({
					posting_amount: -119,
					matches: [
						tAccountMatch({
							id: "match-9",
							plan_item_id: "plan-catering",
							matched_amount: 119,
						}),
					],
				}),
			}),
			{ interaction: actions },
		);

		await userEvent.click(screen.getByRole("button", { name: /entfernen/ }));

		expect(actions.onDetachMatch).toHaveBeenCalledOnce();
	});
});
