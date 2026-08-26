import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarDays } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { SectionCard } from "./SectionCard";

const handleAdd = fn();

const meta = {
	title: "Foundations/SectionCard",
	component: SectionCard,
	tags: ["autodocs"],
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		title: "Upcoming events",
		description: "Everything on the calendar for the next month.",
		icon: CalendarDays,
		children: (
			<p className="text-muted-foreground text-sm">
				Section content goes here.
			</p>
		),
	},
} satisfies Meta<typeof SectionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
	args: {
		actions: (
			<Button size="sm" variant="outline" onClick={handleAdd}>
				Add
			</Button>
		),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const region = canvas.getByRole("region", { name: "Upcoming events" });
		const button = within(region).getByRole("button", { name: "Add" });
		await userEvent.tab();
		await expect(button).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(handleAdd).toHaveBeenCalled();
	},
};

export const Elevated: Story = {
	args: { variant: "elevated" },
};

export const DarkMode: Story = {
	...WithActions,
	globals: { theme: "dark" },
};

export const HeaderlessBody: Story = {
	args: {
		title: undefined,
		description: undefined,
		icon: undefined,
	},
};
