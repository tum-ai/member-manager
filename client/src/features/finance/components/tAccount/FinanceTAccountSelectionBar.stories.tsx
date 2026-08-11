import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FinanceTAccountSelectionBar } from "./FinanceTAccountSelectionBar";

const meta = {
	title: "Features/Finance/FinanceTAccountSelectionBar",
	component: FinanceTAccountSelectionBar,
	parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof FinanceTAccountSelectionBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSelection: Story = {
	args: {
		count: 3,
		grossSum: 4319,
		onCreateProject: fn(),
		onAssignToProject: fn(),
		onClear: fn(),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		// The bar states what is selected and what it is worth, and is reachable as
		// a named landmark from anywhere in a long column.
		await expect(canvas.getByText("3 Buchungen")).toBeVisible();
		await expect(canvas.getByText(/4\.319,00/)).toBeVisible();
		await expect(
			canvas.getByRole("region", { name: "Auswahl" }),
		).toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole("button", { name: /Neues Projekt aus Auswahl/ }),
		);
		await expect(args.onCreateProject).toHaveBeenCalled();

		await userEvent.click(
			canvas.getByRole("button", { name: /Zu Projekt hinzufügen/ }),
		);
		await expect(args.onAssignToProject).toHaveBeenCalled();

		await userEvent.click(
			canvas.getByRole("button", { name: /Auswahl aufheben/ }),
		);
		await expect(args.onClear).toHaveBeenCalled();
	},
};

// One invoice reads as one, not "1 Buchungen".
export const SingleInvoice: Story = {
	args: {
		count: 1,
		grossSum: 119,
		onCreateProject: fn(),
		onAssignToProject: fn(),
		onClear: fn(),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("1 Buchung")).toBeVisible();
	},
};

// Nothing ticked: the bar is not there at all, rather than an empty strip.
export const Empty: Story = {
	args: {
		count: 0,
		grossSum: 0,
		onCreateProject: fn(),
		onAssignToProject: fn(),
		onClear: fn(),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole("region", { name: "Auswahl" })).toBeNull();
	},
};
