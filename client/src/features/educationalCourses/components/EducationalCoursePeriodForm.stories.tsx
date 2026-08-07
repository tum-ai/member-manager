import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EducationalCoursePeriodForm } from "./EducationalCoursePeriodForm";

const meta = {
	title: "Educational Courses/Period Form",
	component: EducationalCoursePeriodForm,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		periods: [],
		numberOfMonths: 1,
		isCreating: false,
		onSubmit: fn(async () => undefined),
	},
} satisfies Meta<typeof EducationalCoursePeriodForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreatePeriod: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const availableDays = canvasElement.querySelectorAll<HTMLButtonElement>(
			"[data-day]:not([data-disabled]) button",
		);
		await expect(availableDays.length).toBeGreaterThan(2);
		await userEvent.click(availableDays[0]);
		await userEvent.click(availableDays[2]);
		const capacity = canvas.getByLabelText("Approval capacity");
		await userEvent.clear(capacity);
		await userEvent.type(capacity, "4");
		await userEvent.click(
			canvas.getByRole("button", { name: "Create open period" }),
		);
		await expect(args.onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ capacity: 4 }),
		);
	},
};
