import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { FinanceAccountSummary } from "@/features/finance/financeTypes";
import { FinanceAccountBreakdownSection } from "./FinanceAccountBreakdownSection";

const accounts: FinanceAccountSummary[] = [
	{
		account: "6850",
		label: "Events",
		income: 0,
		expenses: 10200,
		net: -10200,
		count: 4,
	},
	{
		account: "6840",
		label: "Software & Tools",
		income: 0,
		expenses: 3900,
		net: -3900,
		count: 63,
	},
	{
		account: "8450",
		label: "Sponsorship revenue",
		income: 30000,
		expenses: 0,
		net: 30000,
		count: 3,
	},
];

const meta = {
	title: "Features/Finance/FinanceAccountBreakdownSection",
	component: FinanceAccountBreakdownSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof FinanceAccountBreakdownSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		accounts,
		isLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Events")).toBeInTheDocument();
		await expect(canvas.getByText("Sponsorship revenue")).toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: {
		accounts: undefined,
		isLoading: true,
	},
};

export const Empty: Story = {
	args: {
		accounts: [],
		isLoading: false,
	},
};
