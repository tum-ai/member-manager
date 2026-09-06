import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Composer } from "./Composer";

const meta = {
	title: "Expertise/Composer",
	component: Composer,
	args: { onSubmit: fn(), disabled: false },
	parameters: { layout: "centered", a11y: { test: "error" } },
	decorators: [
		(Story) => (
			<div className="w-[min(42rem,90vw)]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SendQuestion: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Ask Beacon" }),
			"Who knows Swift?",
		);
		await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
		await expect(args.onSubmit).toHaveBeenCalledWith("Who knows Swift?", []);
	},
};
