import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { UnsavedChangesNotice } from "./UnsavedChangesNotice";

const meta = {
	title: "Profile/UnsavedChangesNotice",
	component: UnsavedChangesNotice,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof UnsavedChangesNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("status")).toHaveTextContent(
			/unsaved changes/i,
		);
	},
};

export const WithCompleteness: Story = {
	args: { explainCompleteness: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("status")).toHaveTextContent(
			/percentage above includes them/i,
		);
	},
};
