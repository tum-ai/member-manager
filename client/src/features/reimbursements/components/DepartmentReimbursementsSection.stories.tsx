import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { DepartmentReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { DepartmentReimbursementsSection } from "./DepartmentReimbursementsSection";

const requests: DepartmentReimbursementRequest[] = [
	{
		id: "department-1",
		requester_name: "Ada Lovelace",
		is_own: false,
		amount: 480,
		date: "2026-06-03",
		description: "Venue deposit for the opening ceremony",
		submission_type: "invoice",
		status: "requested",
		approval_status: "pending",
		first_approved_at: "2026-06-04T09:00:00Z",
		payment_status: "to_be_paid",
		created_at: "2026-06-03T09:12:00Z",
	},
	{
		id: "department-2",
		requester_name: "Grace Hopper",
		is_own: true,
		amount: 23.4,
		date: "2026-05-28",
		description: "Snacks for the organiser meeting",
		submission_type: "reimbursement",
		status: "paid",
		approval_status: "approved",
		first_approved_at: "2026-05-29T09:00:00Z",
		payment_status: "paid",
		created_at: "2026-05-28T08:00:00Z",
	},
	{
		id: "department-3",
		requester_name: "Alan Turing",
		is_own: false,
		amount: 129,
		date: "2026-05-14",
		description: "Printed banners",
		submission_type: "vivid_reimbursement",
		status: "rejected",
		approval_status: "not_approved",
		first_approved_at: null,
		payment_status: "not_required",
		created_at: "2026-05-14T18:00:00Z",
	},
];

const meta = {
	title: "Features/Reimbursements/DepartmentReimbursementsSection",
	component: DepartmentReimbursementsSection,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		department: "Makeathon",
		requests,
		page: 1,
		pageCount: 1,
		onPageChange: fn(),
		isChangingPage: false,
		isLoading: false,
		error: null,
	},
} satisfies Meta<typeof DepartmentReimbursementsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

// A colleague's request shows who submitted what, and nothing to open.
export const ListsDepartmentRequests: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("heading", { name: "Makeathon requests" }),
		).toBeVisible();

		const [first, second, third] = canvas.getAllByRole("listitem");
		await expect(
			within(first).getByText("Ada Lovelace · 03 Jun 2026"),
		).toBeVisible();
		await expect(within(first).getByText("First approved")).toBeVisible();
		await expect(within(second).getByText("You · 28 May 2026")).toBeVisible();
		await expect(within(third).getByText("Not approved")).toBeVisible();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
};

// With more than one page, Previous and Next appear; Previous is disabled on
// the first page.
export const Paged: Story = {
	args: { page: 1, pageCount: 3 },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const pages = within(
			canvas.getByRole("navigation", { name: "Department requests pages" }),
		);

		await expect(pages.getByText("Page 1 of 3")).toBeVisible();
		await expect(
			pages.getByRole("link", { name: "Go to previous page" }),
		).toHaveAttribute("aria-disabled", "true");

		await userEvent.click(pages.getByRole("link", { name: "Go to next page" }));
		await expect(args.onPageChange).toHaveBeenLastCalledWith(2);
	},
};

export const Empty: Story = {
	args: { requests: [] },
};

export const Loading: Story = {
	args: { department: null, requests: [], isLoading: true },
};

export const LoadError: Story = {
	args: {
		department: null,
		requests: [],
		error: new Error("Database unavailable"),
	},
};
