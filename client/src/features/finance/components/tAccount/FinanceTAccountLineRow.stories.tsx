import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	tAccountAllocation,
	tAccountGroup,
	tAccountLine,
	tAccountMatch,
	tAccountPlanDetail,
	tAccountPostingDetail,
} from "@/features/finance/financeTAccountFixtures";
import {
	buildTAccountTree,
	type TAccountDisplayLine,
} from "@/features/finance/financeTAccountUtils";
import type { FinanceTAccountLine } from "@/features/finance/financeTypes";
import { FinanceTAccountLineRow } from "./FinanceTAccountLineRow";

const HACKATHON_ID = "22222222-2222-4222-8222-222222222222";

// Build the display line the way the section does, so a story can never drift
// from the real mapping (resolved allocation/match names included).
function displayLine(
	line: FinanceTAccountLine,
	extraLines: FinanceTAccountLine[] = [],
): TAccountDisplayLine {
	const isIncome = line.direction === "income";
	const lines = [line, ...extraLines];
	const [node] = buildTAccountTree([
		tAccountGroup({
			project_id: HACKATHON_ID,
			project_name: "Hackathon",
			expense_lines: isIncome ? [] : lines,
			income_lines: isIncome ? lines : [],
		}),
	]);
	return (isIncome ? node.incomeLines : node.expenseLines)[0];
}

const bookedInvoice = displayLine(
	tAccountLine({
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
			account_label: "Werbe- und Reisekosten",
			cost_location: "120",
			sub_team: "Big Makeathon",
			allocations: [
				tAccountAllocation({
					posting_external_id: "BB-1",
					department: "Makeathon",
					project_id: HACKATHON_ID,
					allocated_amount: -119,
				}),
			],
			matches: [
				tAccountMatch({
					plan_item_id: "plan-catering",
					posting_external_id: "BB-1",
					matched_amount: 119,
				}),
			],
		}),
	}),
	[
		tAccountLine({
			kind: "plan",
			label: "Catering (geplant)",
			amount: 81,
			plan_item_id: "plan-catering",
		}),
	],
);

const plannedItem = displayLine(
	tAccountLine({
		kind: "plan",
		label: "Venue-Miete",
		category: "Location",
		amount: 1190,
		vat_amount: 190,
		vat_rate: 19,
		status: "committed",
		plan_item_id: "plan-venue",
		plan_detail: tAccountPlanDetail({
			expected_month: "2026-05",
			note: "Angebot liegt vor, Vertrag folgt.",
			planned_amount: 3570,
			matched_amount: 2380,
			delta: -1190,
			vat_rate: 19,
			matches: [
				tAccountMatch({
					plan_item_id: "plan-venue",
					posting_external_id: "BB-9",
					matched_amount: 2380,
				}),
			],
		}),
	}),
);

const incomeInvoice = displayLine(
	tAccountLine({
		direction: "income",
		label: "Sponsoring Acme",
		amount: 11_900,
		vat_amount: 1900,
		vat_rate: 19,
		posting_external_id: "BB-2",
		posting_detail: tAccountPostingDetail({
			booking_date: "2026-03-11",
			invoice_number: "AR-2026-0007",
			counterparty: "Acme AG",
			posting_amount: 11_900,
			cost_location: "120",
		}),
	}),
);

const meta = {
	title: "Features/Finance/FinanceTAccountLineRow",
	component: FinanceTAccountLineRow,
	parameters: { layout: "padded", a11y: { test: "error" } },
	decorators: [
		(Story) => (
			<div className="max-w-xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof FinanceTAccountLineRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// A booked invoice: the row states its embedded Vorsteuer in words (never a
// generic "USt", FR-N2) and expands in place to its full detail (FR-K2).
export const BookedInvoice: Story = {
	args: { line: bookedInvoice },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /Catering Kickoff/ });
		await expect(trigger).toHaveAttribute("aria-expanded", "false");
		await expect(canvas.getByText(/inkl\. .* Vorsteuer/)).toBeVisible();

		// Keyboard-operable disclosure, not a click-only affordance.
		trigger.focus();
		await userEvent.keyboard("{Enter}");
		await expect(trigger).toHaveAttribute("aria-expanded", "true");

		await expect(await canvas.findByText("RE-2026-0042")).toBeVisible();
		await expect(canvas.getByText("Kantine München GmbH")).toBeVisible();
		await expect(canvas.getByText(/6840 \/ 1200/)).toBeVisible();
		// The cost location resolves to its sub-team, and the allocation names the
		// project rather than showing a raw uuid.
		await expect(canvas.getByText(/120 · Big Makeathon/)).toBeVisible();
		await expect(canvas.getByText(/Makeathon · Hackathon/)).toBeVisible();
		// The match names the Planposten this invoice feeds.
		await expect(canvas.getByText("Catering (geplant)")).toBeVisible();
	},
};

// A Planposten: same disclosure, different detail — status, expected month and
// the Plan / Ist / Delta readout (FR-K4).
export const PlannedItem: Story = {
	args: { line: plannedItem },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Geplant")).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: /Venue-Miete/ }));

		await expect(await canvas.findByText("Zugesagt")).toBeVisible();
		await expect(canvas.getByText("May 2026")).toBeVisible();
		await expect(canvas.getByText("Plan / Ist / Delta")).toBeVisible();
		await expect(
			canvas.getByText("Angebot liegt vor, Vertrag folgt."),
		).toBeVisible();
		// Planned VAT is labelled by direction too.
		await expect(canvas.getByText("Vorsteuer (geplant)")).toBeVisible();
	},
};

// The same row on the income side: identical mechanics, Umsatzsteuer instead of
// Vorsteuer — the label is what tells the two apart (FR-N2).
export const IncomeInvoice: Story = {
	args: { line: incomeInvoice },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/inkl\. .* Umsatzsteuer/)).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: /Sponsoring Acme/ }),
		);
		await expect(await canvas.findByText("Umsatzsteuer")).toBeVisible();
		await expect(canvas.getByText("AR-2026-0007")).toBeVisible();
	},
};

// A rolled-up child project is a summary of many lines, not an object: it has no
// detail of its own and therefore no disclosure.
export const ProjectRollup: Story = {
	args: {
		line: {
			...bookedInvoice,
			key: "rollup-actual-child",
			label: "Hackathon",
			category: null,
			isProjectRollup: true,
			vatAmount: null,
			postingDetail: null,
			planDetail: null,
			allocations: [],
			matches: [],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Hackathon")).toBeVisible();
		await expect(canvas.queryByRole("button")).toBeNull();
	},
};
