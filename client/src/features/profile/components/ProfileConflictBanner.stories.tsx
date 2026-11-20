import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ProfileConflictBanner } from "./ProfileConflictBanner";

const meta = {
	title: "Profile/Conflict Banner",
	component: ProfileConflictBanner,
	args: {
		onReloadLatest: fn(),
		onKeepMyChanges: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof ProfileConflictBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChangedElsewhere: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole("alert")).toHaveTextContent(/changed elsewhere/i);

		await userEvent.click(
			canvas.getByRole("button", { name: /keep my changes/i }),
		);
		expect(args.onKeepMyChanges).toHaveBeenCalledTimes(1);

		await userEvent.click(
			canvas.getByRole("button", { name: /discard my changes and reload/i }),
		);
		expect(args.onReloadLatest).toHaveBeenCalledTimes(1);
	},
};
