import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ActivationLinkDialog } from "./ActivationLinkDialog";

const meta = {
	title: "Partner Management/Activation Link Dialog",
	component: ActivationLinkDialog,
	args: {
		activation: {
			companyName: "Example Partner",
			link: "https://partners.example.test/activate/example",
			emailSent: true,
		},
		onOpenChange: fn(),
		onCopy: fn(),
	},
} satisfies Meta<typeof ActivationLinkDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(body.getByRole("button", { name: "Copy link" }));
		await expect(args.onCopy).toHaveBeenCalledOnce();
	},
};
