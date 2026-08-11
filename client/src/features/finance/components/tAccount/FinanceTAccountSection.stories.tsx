import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps, ReactElement } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
	tAccountGroup,
	tAccountLine,
	tAccountPlanDetail,
	tAccountPostingDetail,
	tAccountTotals,
} from "@/features/finance/financeTAccountFixtures";
import type { FinanceTAccountGroup } from "@/features/finance/financeTypes";
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
			// A parked Planposten: visible and flagged, but excluded from every plan
			// subtotal and from the forecast (FR-M3).
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
			vat_income: 3260.51,
			vat_expenses: 19,
			vat_payload: 3241.51,
		}),
		isLoading: false,
		error: null,
		onPeriodTypeChange: noop,
		onPeriodKeyChange: noop,
		onDepartmentChange: noop,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Department salden are labelled, and planned lines are flagged (a11y: a
		// badge + dimming, never colour alone). The legend states the code.
		await expect(canvas.getAllByText(/Ist-Saldo/).length).toBeGreaterThan(0);
		await expect(canvas.getAllByText(/Plan-Saldo/).length).toBeGreaterThan(0);
		await expect(canvas.getByText(/Grau = geplant/)).toBeVisible();
		await expect(canvas.getAllByText("Geplant").length).toBeGreaterThan(0);
		// VAT is named by direction on both sides, and the department states what
		// it owes the tax office (FR-N2/FR-N3).
		await expect(canvas.getAllByText("Vorsteuer").length).toBeGreaterThan(0);
		await expect(canvas.getAllByText("Umsatzsteuer").length).toBeGreaterThan(0);
		await expect(canvas.getByText("Zahllast")).toBeVisible();
		// A disabled Planposten stays on screen, flagged as parked.
		await expect(canvas.getByText("Deaktiviert")).toBeVisible();
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

// The workbench half (FR-K5–K7, FR-L1): tick two invoices from two different
// folders, and turn the selection into a project in one call.
export const Workbench: Story = {
	args: {
		...Default.args,
		canWrite: true,
		projects: [],
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
		await userEvent.click(dialog.getByRole("button", { name: "Anlegen" }));

		await expect(args.onCreateProject).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Sponsoring-Kampagne",
				postingExternalIds: ["BB-1", "BB-2"],
			}),
		);
	},
};

// A read-only viewer (no write permission on the department): rows still expand,
// but nothing is selectable and no folder offers a project action (FR-K6).
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
// it as an empty folder (FR-I3); the section must render that folder rather than
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
