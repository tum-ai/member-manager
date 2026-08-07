import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/contexts/ToastContext";
import type { AdminMember } from "@/features/admin/adminUtils";
import { EducationalCourseAdministratorsCard } from "./EducationalCourseAdministratorsCard";

const members = [
	{
		user_id: "10000000-0000-4000-8000-000000000001",
		given_name: "Jordan",
		surname: "Planner",
		email: "jordan@example.com",
		active: true,
		member_status: "active",
		educational_course_role: "administrator",
	},
	{
		user_id: "10000000-0000-4000-8000-000000000002",
		given_name: "Taylor",
		surname: "Teacher",
		email: "taylor@example.com",
		active: true,
		member_status: "active",
		educational_course_role: null,
	},
] as AdminMember[];

const meta = {
	title: "Admin/Educational Course Administrators",
	component: EducationalCourseAdministratorsCard,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		members,
		isUpdating: false,
		onSetAdministrator: fn(),
	},
	decorators: [
		(Story) => (
			<ToastProvider>
				<Story />
			</ToastProvider>
		),
	],
} satisfies Meta<typeof EducationalCourseAdministratorsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssignAdministrator: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(canvas.getByLabelText("Add administrator"), "Taylor");
		await userEvent.click(canvas.getByRole("button", { name: "Add" }));
		await expect(args.onSetAdministrator).toHaveBeenCalledWith({
			userId: "10000000-0000-4000-8000-000000000002",
			enabled: true,
		});
	},
};
