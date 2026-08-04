import type {
	EducationalCourseParticipant,
	EducationalCourseParticipantCandidate,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EducationalCourseParticipantRosterSection } from "./EducationalCourseParticipantRosterSection";

const participants: EducationalCourseParticipant[] = [
	{
		userId: "30000000-0000-4000-8000-000000000001",
		givenName: "Ada",
		surname: "Teacher",
		active: true,
	},
];

const candidate: EducationalCourseParticipantCandidate = {
	userId: "30000000-0000-4000-8000-000000000002",
	givenName: "Taylor",
	surname: "Member",
	email: "taylor@example.com",
};

const meta = {
	title: "Educational Courses/Participant Roster",
	component: EducationalCourseParticipantRosterSection,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		participants,
		eligibleMembers: [candidate],
		search: "Taylor",
		isLoading: false,
		isUpdating: false,
		onSearchChange: fn(),
		onSetParticipant: fn(),
	},
} satisfies Meta<typeof EducationalCourseParticipantRosterSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddParticipant: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Add" }));
		await expect(args.onSetParticipant).toHaveBeenCalledWith(
			candidate.userId,
			true,
		);
	},
};
