import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps, ReactElement } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
	tAccountAllocation,
	tAccountGroup,
	tAccountLine,
	tAccountPlanDetail,
	tAccountPostingDetail,
	tAccountTotals,
} from "@/features/finance/financeTAccountFixtures";
import type {
	FinanceProject,
	FinanceTAccountGroup,
} from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { useFinanceTAccountSelection } from "@/features/finance/hooks/useFinanceTAccountSelection";
import { FinanceTAccountSection } from "./FinanceTAccountSection";

const period: FinancePeriod = { type: "year", key: "2026" };

const MAKEATHON_ID = "11111111-1111-4111-8111-111111111111";
const HACKATHON_ID = "22222222-2222-4222-8222-222222222222";

const groups: FinanceTAccountGroup[] = [
	tAccountGroup({
		expense_lines: [
			tAccountLine({
				label: "Catering",
				category: "Verpflegung",
				amount: 119,
				vat_amount: 19,
				vat_rate: 19,
				posting_external_id: "BB-1",
				posting_detail: tAccountPostingDetail({
					booking_date: "2026-03-04",
					invoice_number: "RE-2026-0042",
					counterparty: "Kantine München GmbH",
					posting_amount: -119,
					debit_account: "6840",
					credit_account: "1200",
					cost_location: "120",
				}),
			}),
			tAccountLine({
				kind: "plan",
				label: "Venue (geplant)",
				amount: 800,
				status: "planned",
				plan_item_id: "p-venue",
			}),
			// A parked plan item: visible and flagged, but excluded from every plan
			// subtotal and from the forecast.
			tAccountLine({
				kind: "plan",
				label: "Merch (gestrichen)",
				amount: 400,
				status: "planned",
				plan_item_id: "p-merch",
				plan_detail: tAccountPlanDetail({
					planned_amount: 400,
					is_active: false,
				}),
			}),
		],
		actual: { income: 0, expenses: 119, saldo: -119 },
		plan: { income: 0, expenses: 919, saldo: -919 },
		vorsteuer: { actual: 19, plan: 0 },
	}),
	tAccountGroup({
		project_id: MAKEATHON_ID,
		project_name: "Makeathon",
		target_amount: 50_000,
		expense_lines: [
			tAccountLine({
				label: "Team-Offsite",
				project_id: MAKEATHON_ID,
				amount: 1200,
				vat_amount: 0,
				posting_external_id: "BB-2",
			}),
			tAccountLine({
				label: "Tooling",
				project_id: MAKEATHON_ID,
				amount: 340,
				vat_amount: 0,
				posting_external_id: "BB-3",
			}),
			tAccountLine({
				kind: "plan",
				label: "Recruiting-Event",
				project_id: MAKEATHON_ID,
				amount: 800,
				status: "planned",
				plan_item_id: "p-recruiting",
			}),
		],
		income_lines: [
			tAccountLine({
				direction: "income",
				label: "Partner-Retainer",
				project_id: MAKEATHON_ID,
				amount: 3000,
				vat_amount: 479,
				vat_rate: 19,
				posting_external_id: "BB-4",
			}),
		],
		actual: { income: 3000, expenses: 1540, saldo: 1460 },
		plan: { income: 3000, expenses: 2340, saldo: 660 },
		umsatzsteuer: { actual: 479, plan: 0 },
	}),
	tAccountGroup({
		project_id: HACKATHON_ID,
		project_name: "Hackathon",
		parent_project_id: MAKEATHON_ID,
		expense_lines: [
			tAccountLine({
				label: "Preise",
				category: "Prizes",
				project_id: HACKATHON_ID,
				amount: 2000,
				vat_amount: 0,
				posting_external_id: "BB-5",
			}),
		],
		income_lines: [
			tAccountLine({
				direction: "income",
				label: "Sponsoring Acme",
				project_id: HACKATHON_ID,
				amount: 17_420,
				vat_amount: 2781.51,
				vat_rate: 19,
				posting_external_id: "BB-6",
			}),
			tAccountLine({
				kind: "plan",
				direction: "income",
				label: "Sponsoring (offen)",
				project_id: HACKATHON_ID,
				amount: 1100,
				status: "planned",
				plan_item_id: "p-sponsor",
			}),
		],
		actual: { income: 17_420, expenses: 2000, saldo: 15_420 },
		plan: { income: 18_520, expenses: 2000, saldo: 16_520 },
		umsatzsteuer: { actual: 2781.51, plan: 0 },
	}),
];

// Drives the real selection hook, so the story exercises what the page does
// rather than a hand-rolled stand-in.
function SelectableSection(
	props: ComponentProps<typeof FinanceTAccountSection>,
): ReactElement {
	const selection = useFinanceTAccountSelection({
		groups: props.groups,
		department: props.department,
		periodType: period.type,
		periodKey: period.key,
	});
	return <FinanceTAccountSection {...props} selection={selection} />;
}

const meta = {
	title: "Features/Finance/FinanceTAccountSection",
	component: FinanceTAccountSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof FinanceTAccountSection>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

export const Default: Story = {
	args: {
		period,
		canChooseDepartment: true,
		department: "Makeathon",
		groups,
		totals: tAccountTotals({
			actual: { income: 20_420, expenses: 3659, saldo: 16_761 },
			plan: { income: 21_520, expenses: 5259, saldo: 16_261 },
			actual_net: { income: 17_159.49, expenses: 3640, saldo: 13_519.49 },
			plan_net: { income: 18_259.49, expenses: 5240, saldo: 13_019.49 },
			vat_income: 3260.51,
			vat_expenses: 19,
			vat_payload: 3241.51,
			vat_payload_forecast: 3241.51,
		}),
		isLoading: false,
		error: null,
		onPeriodTypeChange: noop,
		onPeriodKeyChange: noop,
		onDepartmentChange: noop,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Department balances are labelled, and planned lines are flagged (a11y: a
		// badge + dimming, never colour alone). The legend states the code.
		await expect(canvas.getAllByText(/Ist-Saldo/).length).toBeGreaterThan(0);
		await expect(canvas.getAllByText(/Plan-Saldo/).length).toBeGreaterThan(0);
		await expect(canvas.getByText(/Grau = geplant/)).toBeVisible();
		await expect(canvas.getAllByText("Geplant").length).toBeGreaterThan(0);
		// VAT is named by direction on both sides, and the department states what
		// it owes the tax office.
		await expect(canvas.getAllByText("Vorsteuer").length).toBeGreaterThan(0);
		await expect(canvas.getAllByText("Umsatzsteuer").length).toBeGreaterThan(0);
		await expect(canvas.getByText("Zahllast")).toBeVisible();
		// A parked plan item is out of the way but still reachable.
		const parked = canvas.getByRole("button", { name: /Deaktiviert \(1\)/ });
		await expect(parked).toBeVisible();
		await userEvent.click(parked);
		await expect(await canvas.findByText("Merch (gestrichen)")).toBeVisible();
		// A booked invoice expands in place to its detail, without a round-trip.
		await userEvent.click(canvas.getByRole("button", { name: /Catering/ }));
		await expect(await canvas.findByText("RE-2026-0042")).toBeVisible();
		// The Makeathon project shows its Zielsaldo on the collapsed header and
		// expands to reveal its deviation-vs-target and its rolled-up child.
		await expect(canvas.getByText(/Zielsaldo/)).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: /Makeathon/ }));
		await expect(await canvas.findByText(/Abweichung zum Ziel/)).toBeVisible();
		// The nested Hackathon project expands to its own detail lines.
		await userEvent.click(canvas.getByRole("button", { name: /Hackathon/ }));
		await expect(await canvas.findByText("Sponsoring Acme")).toBeVisible();
	},
};

// The workbench half: tick two invoices from two different folders, and turn
// the selection into a project in one call.
const makeathonProject: FinanceProject = {
	id: MAKEATHON_ID,
	parent_project_id: null,
	name: "Makeathon",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	tax_area: null,
	target_amount: 50_000,
	status: "active",
	description: null,
	sub_team: "Big Makeathon",
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

export const Workbench: Story = {
	args: {
		...Default.args,
		canWrite: true,
		projects: [makeathonProject],
		isCreatingProject: false,
		isAssigning: false,
		onCreateProject: fn(),
		onAssignToProject: fn(),
	},
	render: (args) => <SelectableSection {...args} />,
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		// Nothing ticked yet: no selection bar.
		await expect(canvas.queryByRole("region", { name: "Auswahl" })).toBeNull();

		await userEvent.click(canvas.getByRole("checkbox", { name: /Catering/ }));
		const bar = await canvas.findByRole("region", { name: "Auswahl" });
		await expect(within(bar).getByText("1 Buchung")).toBeVisible();

		// Selection spans folders: open the project and tick one of its invoices.
		await userEvent.click(canvas.getByRole("button", { name: /Makeathon/ }));
		await userEvent.click(
			await canvas.findByRole("checkbox", { name: /Team-Offsite/ }),
		);
		await expect(within(bar).getByText("2 Buchungen")).toBeVisible();

		await userEvent.click(
			within(bar).getByRole("button", { name: /Neues Projekt aus Auswahl/ }),
		);

		// The dialog states what it is about to do before it does it.
		const dialog = within(await screen.findByRole("dialog"));
		await expect(
			dialog.getByText(/2 Buchungen über .* werden dem neuen Projekt/),
		).toBeVisible();
		await userEvent.type(dialog.getByLabelText(/Name/), "Sponsoring-Kampagne");

		// A selection spans folders, so it starts unplaced — placement is chosen
		// here, not inherited. Both pickers are real controls.
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(dialog.getByRole("combobox", { name: "Sub-Team" }));
		await userEvent.click(
			await body.findByRole("option", { name: "Big Makeathon" }),
		);
		await userEvent.click(
			dialog.getByRole("combobox", { name: "Übergeordnetes Projekt" }),
		);
		await userEvent.click(
			await body.findByRole("option", { name: "Makeathon" }),
		);
		// Picking a parent turns it into a sub-project.
		await expect(dialog.getByText("Neues Teilprojekt")).toBeVisible();

		await userEvent.click(dialog.getByRole("button", { name: "Anlegen" }));

		await expect(args.onCreateProject).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Sponsoring-Kampagne",
				parentProjectId: MAKEATHON_ID,
				// Inherited from the chosen parent, which lives in that sub-team.
				subTeam: "Big Makeathon",
				postingExternalIds: ["BB-1", "BB-2"],
			}),
		);
	},
};

// A department that may be written must be able to open its first project even
// when it has no bookings and no plan items at all.
export const EmptyWritableDepartment: Story = {
	args: {
		period,
		canChooseDepartment: true,
		department: "Makeathon",
		groups: [],
		totals: tAccountTotals(),
		isLoading: false,
		error: null,
		onPeriodTypeChange: noop,
		onPeriodKeyChange: noop,
		onDepartmentChange: noop,
		canWrite: true,
		projects: [],
		onCreateProject: fn(),
		onAssignToProject: fn(),
	},
	render: (args) => <SelectableSection {...args} />,
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/Keine Buchungen oder Planposten/),
		).toBeVisible();

		await userEvent.click(
			canvas.getByRole("button", { name: /Neues Projekt/ }),
		);
		const dialog = within(await screen.findByRole("dialog"));
		await userEvent.type(dialog.getByLabelText(/Name/), "Erstes Projekt");
		await userEvent.click(dialog.getByRole("button", { name: "Anlegen" }));

		await expect(args.onCreateProject).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Erstes Projekt",
				parentProjectId: null,
				subTeam: null,
				postingExternalIds: [],
			}),
		);
	},
};

// One toggle switches every amount in the view — the rows, the column subtotals
// and the department balances — and the header says which mode is on.
export const NettoBrutto: Story = {
	args: Default.args,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Gross by default: the invoice shows what the bank moved, VAT included.
		await expect(canvas.getByText(/Beträge brutto/)).toBeVisible();
		await expect(canvas.getByText("16.761,00 €")).toBeVisible();
		await expect(canvas.getByText(/inkl\. .* Vorsteuer/)).toBeVisible();

		await userEvent.click(canvas.getByRole("radio", { name: "Nettobeträge" }));

		// Net: the header states the mode, the balance is the net one, and the VAT
		// now sits on top of the amount rather than inside it.
		await expect(canvas.getByText(/Beträge netto/)).toBeVisible();
		await expect(canvas.getByText("13.519,49 €")).toBeVisible();
		await expect(canvas.getByText(/zzgl\. .* Vorsteuer/)).toBeVisible();
		await expect(canvas.queryByText("16.761,00 €")).toBeNull();

		// The VAT figures themselves are the same money either way.
		await expect(canvas.getByText("3.260,51 €")).toBeVisible();
	},
};

// A plan item is planned on the node where the money will be spent, and the
// dialog opens with that folder already stated.
export const PlanFromNode: Story = {
	args: {
		...Default.args,
		canWrite: true,
		projects: [],
		onSavePlanItem: fn(),
	},
	render: (args) => <SelectableSection {...args} />,
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: /Makeathon/ }));
		const projectPanel = await canvas.findByText(/Abweichung zum Ziel/);
		await expect(projectPanel).toBeVisible();

		// The project folder offers its own "Neuer Planposten" action.
		const buttons = canvas.getAllByRole("button", { name: "Neuer Planposten" });
		await userEvent.click(buttons[buttons.length - 1]);

		const dialog = within(await screen.findByRole("dialog"));
		await expect(dialog.getByText(/Wird in .Makeathon/)).toBeVisible();
		await userEvent.type(
			dialog.getByLabelText(/Bezeichnung/),
			"Venue-Anzahlung",
		);
		await userEvent.clear(dialog.getByLabelText(/Betrag/));
		await userEvent.type(dialog.getByLabelText(/Betrag/), "2500");
		await userEvent.click(dialog.getByRole("button", { name: "Anlegen" }));

		await expect(args.onSavePlanItem).toHaveBeenCalledWith(
			expect.objectContaining({
				id: null,
				label: "Venue-Anzahlung",
				plannedAmount: 2500,
				projectId: MAKEATHON_ID,
			}),
		);
	},
};

// Regression (PR #321 review): the split editor is the only direct allocation
// editor left since Abgleich retired, so a reviewer has to reach it on a
// posting that carries no allocation at all — and what opens has to be a working
// editor, not a form waiting for rows that never existed.
export const SplitUnsplitInvoice: Story = {
	args: {
		...Default.args,
		canWrite: true,
		canReview: true,
		projects: [makeathonProject],
		onAssignToProject: fn(),
		onSplitAllocation: fn(),
	},
	render: (args) => <SelectableSection {...args} />,
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		// The Catering invoice came straight from the import: no allocation stored,
		// so the retired gate (`allocations.length > 1`) hid this action entirely.
		await userEvent.click(canvas.getByRole("button", { name: /Catering/ }));
		await userEvent.click(
			await canvas.findByRole("button", { name: "Aufteilung bearbeiten" }),
		);

		const dialog = within(await screen.findByRole("dialog"));
		// It says what it is about to do, and for this posting that is not
		// "replace the existing split".
		await expect(
			dialog.getByText(/noch keine gespeicherte Aufteilung/),
		).toBeVisible();

		// Usable from the first render: one 100 % row on the department the
		// T-account is showing, ready to be split further.
		await userEvent.click(
			dialog.getByRole("radio", { name: "Prozentuale Aufteilung" }),
		);
		await expect(dialog.getByLabelText("Anteil (%)")).toHaveValue(100);
		await userEvent.click(
			dialog.getByRole("button", { name: "Aufteilung hinzufügen" }),
		);
		await userEvent.click(
			dialog.getByRole("combobox", { name: "Department für Aufteilung 2" }),
		);
		await userEvent.click(
			await body.findByRole("option", { name: "Marketing" }),
		);
		await userEvent.click(
			dialog.getByRole("button", { name: "Aufteilung speichern" }),
		);

		await expect(args.onSplitAllocation).toHaveBeenCalledWith({
			postingExternalId: "BB-1",
			allocations: [
				expect.objectContaining({ department: "Makeathon", percentage: 50 }),
				expect.objectContaining({ department: "Marketing", percentage: 50 }),
			],
		});
	},
};

// The Catering invoice after a 50/50 split across two departments. This is the
// shape the retired `allocations.length > 1` gate *did* offer the editor for —
// to every writer, department members included, whose save the reviewer-only
// endpoint then refused with a 403.
const splitInvoiceGroups: FinanceTAccountGroup[] = [
	tAccountGroup({
		expense_lines: [
			tAccountLine({
				label: "Catering",
				category: "Verpflegung",
				amount: 59.5,
				vat_amount: 9.5,
				vat_rate: 19,
				posting_external_id: "BB-1",
				posting_detail: tAccountPostingDetail({
					booking_date: "2026-03-04",
					invoice_number: "RE-2026-0042",
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
		],
		actual: { income: 0, expenses: 59.5, saldo: -59.5 },
		plan: { income: 0, expenses: 0, saldo: 0 },
		vorsteuer: { actual: 9.5, plan: 0 },
	}),
];

// A department member may write their own department, but the split editor saves
// through the reviewer-only replace endpoint — so that one action is withheld
// while the rest of their write surface stays exactly as it was.
export const DepartmentMemberWithoutReview: Story = {
	args: {
		...Default.args,
		groups: splitInvoiceGroups,
		totals: tAccountTotals({
			actual: { income: 0, expenses: 59.5, saldo: -59.5 },
			actual_net: { income: 0, expenses: 50, saldo: -50 },
			vat_expenses: 9.5,
		}),
		canWrite: true,
		canReview: false,
		projects: [makeathonProject],
		onAssignToProject: fn(),
		onSplitAllocation: fn(),
	},
	render: (args) => <SelectableSection {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: /Catering/ }));

		await expect(
			await canvas.findByRole("button", { name: "Zu Projekt hinzufügen" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Planposten zuordnen" }),
		).toBeVisible();
		// A member cannot replace an allocation themselves, but may still ask for
		// the posting to be moved.
		await expect(
			canvas.getByRole("button", { name: "Umverteilung beantragen" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("checkbox", { name: /Catering/ }),
		).toBeVisible();

		await expect(
			canvas.queryByRole("button", { name: "Aufteilung bearbeiten" }),
		).toBeNull();
	},
};

// A read-only viewer (no write permission on the department): rows still expand,
// but nothing is selectable and no folder offers a project action.
export const ReadOnly: Story = {
	args: { ...Default.args, canWrite: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole("checkbox")).toBeNull();
		await expect(
			canvas.queryByRole("button", { name: /Neues Projekt/ }),
		).toBeNull();
		// The disclosure still works.
		await userEvent.click(canvas.getByRole("button", { name: /Catering/ }));
		await expect(await canvas.findByText("RE-2026-0042")).toBeVisible();
	},
};

export const PickDepartment: Story = {
	args: {
		period,
		canChooseDepartment: true,
		department: null,
		groups: [],
		totals: undefined,
		isLoading: false,
		error: null,
		onPeriodTypeChange: noop,
		onPeriodKeyChange: noop,
		onDepartmentChange: noop,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/Bitte ein Department wählen/),
		).toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: {
		period,
		canChooseDepartment: true,
		department: "Makeathon",
		groups: [],
		totals: undefined,
		isLoading: true,
		error: null,
		onPeriodTypeChange: noop,
		onPeriodKeyChange: noop,
		onDepartmentChange: noop,
	},
};

// A freshly created project with no postings or plan lines yet. The server emits
// it as an empty folder; the section must render that folder rather than
// collapsing to the "no activity" empty-state card.
export const EmptyProjectOnly: Story = {
	args: {
		period,
		canChooseDepartment: true,
		department: "Makeathon",
		groups: [
			tAccountGroup({
				project_id: MAKEATHON_ID,
				project_name: "Neues Projekt",
			}),
		],
		totals: tAccountTotals(),
		isLoading: false,
		error: null,
		onPeriodTypeChange: noop,
		onPeriodKeyChange: noop,
		onDepartmentChange: noop,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The named project folder renders...
		await expect(
			canvas.getByRole("button", { name: /Neues Projekt/ }),
		).toBeVisible();
		// ...and the "no activity" empty-state card does not take over.
		await expect(
			canvas.queryByText(/Keine Buchungen oder Planposten/),
		).toBeNull();
	},
};
