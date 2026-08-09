import type { EducationalCoursePeriod } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EducationalCoursePeriodsSection } from "./EducationalCoursePeriodsSection";

const period: EducationalCoursePeriod = {
	id: "20000000-0000-4000-8000-000000000001",
	startsOn: "2030-09-16",
	endsOn: "2030-09-22",
	capacity: 2,
	applicationsOpen: true,
	approvedParticipants: [
		{
			userId: "30000000-0000-4000-8000-000000000001",
			displayName: "Ada Teacher",
		},
	],
	myApplication: null,
	createdAt: "2026-08-01T10:00:00.000Z",
	updatedAt: "2026-08-01T10:00:00.000Z",
};

const meta = {
	title: "Educational Courses/Periods",
	component: EducationalCoursePeriodsSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		role: "participant",
		periods: [period],
		selectedPeriodId: period.id,
		isUpdatingPeriod: false,
		isDeletingPeriod: false,
		isUpdatingApplication: false,
		onSelectPeriod: fn(),
		onSetApplicationsOpen: fn(),
		onDeletePeriod: fn(),
		onApply: fn(),
		onWithdraw: fn(),
	},
} satisfies Meta<typeof EducationalCoursePeriodsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ParticipantCanApply: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Apply" }));
		await expect(args.onApply).toHaveBeenCalledWith(period.id);
	},
};

export const AdministratorCanCloseApplications: Story = {
	args: { role: "administrator" },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Close" }));
		await expect(args.onSetApplicationsOpen).toHaveBeenCalledWith(
			period.id,
			false,
		);
	},
};
