import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { FinanceAnalyticsResponse } from "@/features/finance/financeTypes";
import { FinanceAnalyticsSection } from "./FinanceAnalyticsSection";

const analytics: FinanceAnalyticsResponse = {
	by_department: [
		{
			department: "Makeathon",
			bereich: "wirtschaftlich",
			income: 0,
			expenses: 14100,
			net: -14100,
			count: 5,
			unmapped: false,
		},
		{
			department: "Partnerships",
			bereich: "ideell",
			income: 30000,
			expenses: 0,
			net: 30000,
			count: 3,
			unmapped: false,
		},
		{
			department: "Nicht zugeordnet",
			bereich: null,
			income: 0,
			expenses: 540,
			net: -540,
			count: 6,
			unmapped: true,
		},
	],
	by_category: [
		{
			category: "Catering",
			income: 0,
			expenses: 6840,
			net: -6840,
			count: 3,
			unmapped: false,
		},
		{
			category: "Location",
			income: 0,
			expenses: 4800,
			net: -4800,
			count: 1,
			unmapped: false,
		},
		{
			category: "Ohne Kategorie",
			income: 30000,
			expenses: 3000,
			net: 27000,
			count: 10,
			unmapped: true,
		},
	],
	by_account: [
		{
			account: "6850",
			label: "Veranstaltungen",
			income: 0,
			expenses: 10200,
			net: -10200,
			count: 4,
		},
		{
			account: "8450",
			label: "Sponsoring",
			income: 30000,
			expenses: 0,
			net: 30000,
			count: 3,
		},
		{
			account: "6840",
			label: null,
			income: 0,
			expenses: 3900,
			net: -3900,
			count: 9,
		},
	],
	by_month: [
		{ month: "2026-01", income: 15000, expenses: 3200, net: 11800 },
		{ month: "2026-02", income: 7500, expenses: 4100, net: 3400 },
		{ month: "2026-03", income: 6000, expenses: 2600, net: 3400 },
	],
	by_bereich: [
		{
			bereich: "wirtschaftlich",
			income: 0,
			expenses: 14100,
			net: -14100,
			count: 5,
		},
		{ bereich: "ideell", income: 30000, expenses: 0, net: 30000, count: 3 },
	],
	by_vat_rate: [],
	totals: {
		income: 30000,
		expenses: 14640,
		net: 15360,
		count: 14,
		vat: 0,
		unmapped_count: 6,
	},
	source: "mock",
	generated_at: "2026-07-18T12:00:00.000Z",
};

const meta = {
	title: "Features/Finance/FinanceAnalyticsSection",
	component: FinanceAnalyticsSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof FinanceAnalyticsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs = {
	range: { dateFrom: "2026-01-01", dateTo: "2026-07-18" },
	isLoading: false,
	isFetching: false,
	error: null,
	onDateFromChange: () => undefined,
	onDateToChange: () => undefined,
	onRefresh: () => undefined,
};

export const Default: Story = {
	args: { ...baseArgs, analytics },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("Ausgaben pro Department"),
		).toBeInTheDocument();
		await expect(
			canvas.getByText(/noch nicht\s+zugeordnete Kostenstelle/),
		).toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: { ...baseArgs, analytics: undefined, isLoading: true },
};
