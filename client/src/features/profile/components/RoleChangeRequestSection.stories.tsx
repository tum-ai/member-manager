import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { MemberChangeRequest } from "@/hooks/useMemberChangeRequests";
import { RoleChangeRequestSection } from "./RoleChangeRequestSection";

const requests: MemberChangeRequest[] = [
	{
		id: "request-vice-president",
		user_id: "member-1",
		status: "pending",
		changes: { member_role: "Vice-President", department: null },
		reason: "Supporting the president next semester.",
		created_at: "2026-04-25T12:00:00Z",
	},
	{
		id: "request-president",
		user_id: "member-1",
		status: "pending",
		changes: { member_role: "President", department: null },
		reason: "Running for president.",
		created_at: "2026-04-24T12:00:00Z",
	},
	{
		id: "request-team-lead",
		user_id: "member-1",
		status: "rejected",
		changes: { member_role: "Team Lead", department: "Software Development" },
		reason: "Leading the platform team.",
		review_note: "Team lead changes require board confirmation.",
		created_at: "2026-03-02T12:00:00Z",
	},
];

const meta = {
	title: "Profile/Role Change Request Section",
	component: RoleChangeRequestSection,
	args: {
		requestedRole: "",
		setRequestedRole: fn(),
		requestedDepartment: "",
		setRequestedDepartment: fn(),
		isRequestingAlumniStatus: false,
		setIsRequestingAlumniStatus: fn(),
		changeRequestReason: "",
		setChangeRequestReason: fn(),
		memberChangeRequests: requests,
		isSubmittingChangeRequest: false,
		onSubmitMemberChangeRequest: fn(),
		ids: {
			requestedRole: "story-requested-role",
			requestedDepartment: "story-requested-department",
			alumniCheckbox: "story-alumni",
			reason: "story-reason",
		},
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof RoleChangeRequestSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultipleRequests: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const pending = canvas.getByRole("list", { name: "Pending review" });
		const pendingItems = within(pending).getAllByRole("listitem");
		await expect(pendingItems).toHaveLength(2);
		await expect(
			within(pendingItems[0]).getByText("Vice-President"),
		).toBeVisible();
		await expect(within(pendingItems[1]).getByText("President")).toBeVisible();

		const reviewed = canvas.getByRole("list", { name: "Reviewed" });
		await expect(within(reviewed).getByText("Rejected")).toBeVisible();

		await userEvent.click(
			canvas.getByRole("button", { name: "Request changes" }),
		);
		await expect(args.onSubmitMemberChangeRequest).toHaveBeenCalledOnce();
	},
};

export const NoRequests: Story = {
	args: {
		memberChangeRequests: [],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("heading", { name: "Your requests" }),
		).not.toBeInTheDocument();
	},
};
