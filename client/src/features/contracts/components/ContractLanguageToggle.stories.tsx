import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ContractLanguageToggle } from "./ContractLanguageToggle";

const meta = {
	title: "Contracts/LanguageToggle",
	component: ContractLanguageToggle,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		value: "de",
		englishAvailable: true,
		onChange: fn(),
	},
} satisfies Meta<typeof ContractLanguageToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SwitchesToEnglish: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("radio", { name: "English" }));
		await expect(args.onChange).toHaveBeenCalledWith("en");
	},
};

export const WithoutTranslation: Story = {
	args: { englishAvailable: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("radio", { name: "English" })).toBeDisabled();
		await expect(
			canvas.getByText("This template is only available in German."),
		).toBeVisible();
	},
};
