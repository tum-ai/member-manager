import type { EducationalCoursePeriod } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EducationalCourseCalendarSection } from "./EducationalCourseCalendarSection";

const period: EducationalCoursePeriod = {
	id: "20000000-0000-4000-8000-000000000001",
	startsOn: "2030-09-16",
	endsOn: "2030-09-22",
	capacity: 2,
	applicationsOpen: true,
	approvedParticipants: [],
	myApplication: null,
	createdAt: "2026-08-01T10:00:00.000Z",
	updatedAt: "2026-08-01T10:00:00.000Z",
};

const meta = {
	title: "Educational Courses/Calendar",
	component: EducationalCourseCalendarSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		periods: [period],
		selectedPeriodId: null,
		numberOfMonths: 1,
		onSelectPeriod: fn(),
	},
} satisfies Meta<typeof EducationalCourseCalendarSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectHighlightedDate: Story = {
	play: async ({ args, canvasElement }) => {
		const dayButton = within(canvasElement).getByRole("button", {
			name: /Monday, September 16th, 2030/i,
		});
		await userEvent.click(dayButton);
		await expect(args.onSelectPeriod).toHaveBeenCalledWith(period.id);
	},
};
