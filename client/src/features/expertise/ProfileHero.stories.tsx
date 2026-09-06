import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ProfileHero } from "./ProfileHero";

const meta = {
	title: "Expertise/Profile Hero",
	component: ProfileHero,
	args: {
		name: "Ada Lovelace",
		initials: "AL",
		role: "Member",
		dept: "Tech",
		headline: "AI systems builder",
		confirmed: 8,
		pending: 2,
		editable: true,
		optedOut: false,
		onToggleOptOut: fn(),
		busyOptOut: false,
	},
	parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof ProfileHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditableProfile: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("switch", {
				name: "Opt out of expertise directory",
			}),
		);
		await expect(args.onToggleOptOut).toHaveBeenCalledWith(true);
	},
};
