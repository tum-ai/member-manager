import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ClaimDialog } from "./ClaimDialog";

const meta = {
	title: "Expertise/Claim Dialog",
	component: ClaimDialog,
	args: {
		type: "skill",
		open: true,
		onOpenChange: fn(),
		onSave: fn(async () => {}),
		busy: false,
	},
	parameters: { layout: "centered", a11y: { test: "error" } },
} satisfies Meta<typeof ClaimDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddSkill: Story = {
	play: async ({ args, canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.type(body.getByLabelText("Skill"), "Swift");
		await userEvent.click(body.getByRole("button", { name: "Add" }));
		await expect(args.onSave).toHaveBeenCalledWith({ skill_name: "Swift" });
	},
};
