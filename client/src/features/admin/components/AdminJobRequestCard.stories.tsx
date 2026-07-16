import type { JobPostingRequest } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AdminJobRequestCard } from "./AdminJobRequestCard";

const request: JobPostingRequest = {
	id: "job-1",
	user_id: "member-1",
	status: "pending",
	title: "AI Engineer",
	organization_name: "Example GmbH",
	logo_url: null,
	description_markdown:
		"Build production AI systems with our engineering team. ".repeat(12),
	call_to_action: "Apply now",
	job_type: "full_time",
	location: "Munich",
	contact_name: "Taylor Example",
	contact_email: "jobs@example.com",
	contact_role: "Talent",
	external_url: "https://example.com/jobs/ai-engineer",
	expires_at: null,
};

const meta = {
	title: "Admin/Job Request Card",
	component: AdminJobRequestCard,
	args: {
		request,
		requesterName: "Taylor Example",
		isActionPending: false,
		onReview: fn(),
		onEdit: fn(),
		onRemove: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof AdminJobRequestCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingRequest: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Approve job posting request for Taylor Example",
			}),
		);
		await expect(args.onReview).toHaveBeenCalledWith("approved");
	},
};
