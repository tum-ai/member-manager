import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FinanceBudgetTransferSection } from "./FinanceBudgetTransferSection";

const meta = {
	title: "Finance/FinanceBudgetTransferSection",
	component: FinanceBudgetTransferSection,
	args: {
		period: { type: "year", key: "2026" },
		requests: [],
		department: null,
		canManage: true,
		isSubmitting: false,
		reviewingRequestId: null,
		onCreate: fn(),
		onReview: fn(),
	},
} satisfies Meta<typeof FinanceBudgetTransferSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByLabelText("Budget source"));
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(
			await body.findByRole("option", { name: "Makeathon" }),
		);
		await expect(
			canvas.getByText("No budget transfers available."),
		).toBeInTheDocument();
	},
};
