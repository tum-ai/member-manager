import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { UnsavedChangesNotice } from "./UnsavedChangesNotice";

const meta = {
	title: "Profile/Unsaved Changes Notice",
	component: UnsavedChangesNotice,
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof UnsavedChangesNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			"Unsaved changes",
		);
	},
};

export const ExplainsCompleteness: Story = {
	args: { explainCompleteness: true },
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			"the percentage above includes them",
		);
	},
};
