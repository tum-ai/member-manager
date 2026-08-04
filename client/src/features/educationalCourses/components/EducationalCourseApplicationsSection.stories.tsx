import type { EducationalCoursePeriodDetail } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EducationalCourseApplicationsSection } from "./EducationalCourseApplicationsSection";

const detail: EducationalCoursePeriodDetail = {
	period: {
		id: "20000000-0000-4000-8000-000000000001",
		startsOn: "2030-09-16",
		endsOn: "2030-09-22",
		capacity: 2,
		applicationsOpen: true,
		approvedParticipants: [],
		myApplication: null,
		createdAt: "2026-08-01T10:00:00.000Z",
		updatedAt: "2026-08-01T10:00:00.000Z",
	},
	applications: [
		{
			id: "40000000-0000-4000-8000-000000000001",
			periodId: "20000000-0000-4000-8000-000000000001",
			userId: "30000000-0000-4000-8000-000000000001",
			givenName: "Taylor",
			surname: "Teacher",
			status: "pending",
			reviewedAt: null,
			createdAt: "2026-08-02T10:00:00.000Z",
			updatedAt: "2026-08-02T10:00:00.000Z",
		},
	],
};

const meta = {
	title: "Educational Courses/Application Review",
	component: EducationalCourseApplicationsSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		detail,
		isLoading: false,
		isReviewing: false,
		onReview: fn(),
	},
} satisfies Meta<typeof EducationalCourseApplicationsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApproveApplication: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
		await expect(args.onReview).toHaveBeenCalledWith(
			"40000000-0000-4000-8000-000000000001",
			"20000000-0000-4000-8000-000000000001",
			"approved",
		);
	},
};
