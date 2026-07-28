import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type {
	FinanceAnalyticsResponse,
	FinanceVatRateSummary,
} from "@/features/finance/financeTypes";
import { FinanceVatSummarySection } from "./FinanceVatSummarySection";

const totals: FinanceAnalyticsResponse["totals"] = {
	income: 30000,
	expenses: 14640,
	net: 15360,
	vat: 2210,
	count: 42,
	unmapped_count: 6,
};

const byVatRate: FinanceVatRateSummary[] = [
	{ rate: 19, expenses: 13840, vat: 2210, count: 34 },
	{ rate: 7, expenses: 0, vat: 0, count: 0 },
	{ rate: 0, expenses: 800, vat: 0, count: 8 },
];

const meta = {
	title: "Features/Finance/FinanceVatSummarySection",
	component: FinanceVatSummarySection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof FinanceVatSummarySection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		totals,
		byVatRate,
		isLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Included VAT (USt.)")).toBeInTheDocument();
		await expect(canvas.getByText("19 %")).toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: {
		totals: undefined,
		byVatRate: undefined,
		isLoading: true,
	},
};

export const Empty: Story = {
	args: {
		totals: {
			income: 0,
			expenses: 0,
			net: 0,
			vat: 0,
			count: 0,
			unmapped_count: 0,
		},
		byVatRate: [],
		isLoading: false,
	},
};
