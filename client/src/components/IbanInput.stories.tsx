import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Label } from "@/components/ui/label";
import { IBAN_INVALID_HINT, IBAN_VALID_HINT, IbanInput } from "./IbanInput";

const meta = {
	title: "Components/IbanInput",
	component: IbanInput,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		id: "story-iban",
		value: "",
		onValueChange: fn(),
	},
	render: (args) => {
		const [value, setValue] = useState(args.value);
		return (
			<div className="flex max-w-sm flex-col gap-1.5">
				<Label htmlFor={args.id}>IBAN</Label>
				<IbanInput
					{...args}
					value={value}
					onValueChange={(next) => {
						setValue(next);
						args.onValueChange(next);
					}}
				/>
			</div>
		);
	},
} satisfies Meta<typeof IbanInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Prefilled: Story = {
	args: { value: "DE89370400440532013000" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText("IBAN")).toHaveValue(
			"DE89 3704 0044 0532 0130 00",
		);
		await expect(canvas.getByText(IBAN_VALID_HINT)).toBeVisible();
	},
};

export const TypingAndPasting: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByLabelText("IBAN");

		await userEvent.type(input, "de8937040044");
		await expect(input).toHaveValue("DE89 3704 0044");
		await expect(input).toHaveAttribute("aria-invalid", "false");

		await userEvent.clear(input);
		await userEvent.click(input);
		await userEvent.paste("IBAN: DE89 3704 0044 0532 0130 00");
		await expect(input).toHaveValue("DE89 3704 0044 0532 0130 00");
		await expect(args.onValueChange).toHaveBeenLastCalledWith(
			"DE89370400440532013000",
		);
		await expect(canvas.getByText(IBAN_VALID_HINT)).toBeVisible();
	},
};

export const Invalid: Story = {
	args: { value: "DE89370400440532013001" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText("IBAN")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		await expect(canvas.getByText(IBAN_INVALID_HINT)).toBeVisible();
	},
};

export const WithExternalError: Story = {
	args: { error: "IBAN is required." },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText("IBAN")).toHaveAccessibleDescription(
			"IBAN is required.",
		);
	},
};
