import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { FinanceCategorySummary } from "@/features/finance/financeTypes";
import { FinanceCategoryBreakdownSection } from "./FinanceCategoryBreakdownSection";

const categories: FinanceCategorySummary[] = [
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
		category: "Software",
		income: 0,
		expenses: 1200,
		net: -1200,
		count: 40,
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
];

const meta = {
	title: "Features/Finance/FinanceCategoryBreakdownSection",
	component: FinanceCategoryBreakdownSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof FinanceCategoryBreakdownSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		categories,
		isLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Catering")).toBeInTheDocument();
		await expect(canvas.getByText("Ohne Kategorie")).toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: {
		categories: undefined,
		isLoading: true,
	},
};

export const Empty: Story = {
	args: {
		categories: [],
		isLoading: false,
	},
};
