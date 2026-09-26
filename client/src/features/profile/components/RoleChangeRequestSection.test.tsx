import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleChangeRequestSection } from "./RoleChangeRequestSection";

function renderSection(
	overrides: Partial<
		React.ComponentProps<typeof RoleChangeRequestSection>
	> = {},
) {
	const props: React.ComponentProps<typeof RoleChangeRequestSection> = {
		requestedRole: "",
		setRequestedRole: vi.fn(),
		requestedDepartment: "",
		setRequestedDepartment: vi.fn(),
		isRequestingAlumniStatus: false,
		setIsRequestingAlumniStatus: vi.fn(),
		changeRequestReason: "",
		setChangeRequestReason: vi.fn(),
		memberChangeRequests: [],
		isSubmittingChangeRequest: false,
		onSubmitMemberChangeRequest: vi.fn(),
		ids: {
			requestedRole: "requested-role",
			requestedDepartment: "requested-department",
			alumniCheckbox: "alumni",
			reason: "reason",
		},
		...overrides,
	};
	render(<RoleChangeRequestSection {...props} />);
	return props;
}

describe("RoleChangeRequestSection", () => {
	it("invokes the submit handler when the button is clicked", async () => {
		const user = userEvent.setup();
		const props = renderSection();

		await user.click(screen.getByRole("button", { name: /request changes/i }));

		expect(props.onSubmitMemberChangeRequest).toHaveBeenCalledOnce();
	});

	it("toggles alumni status", async () => {
		const user = userEvent.setup();
		const props = renderSection();

		await user.click(screen.getByLabelText(/request alumni status/i));

		expect(props.setIsRequestingAlumniStatus).toHaveBeenCalledWith(true);
	});

	it("shows every submitted request, not just the newest (#325)", () => {
		renderSection({
			memberChangeRequests: [
				{
					id: "r-vp",
					user_id: "user-1",
					status: "pending",
					changes: { member_role: "Vice-President", department: null },
					reason: "Backup for the board",
					created_at: "2026-04-25T10:00:00Z",
				},
				{
					id: "r-president",
					user_id: "user-1",
					status: "pending",
					changes: { member_role: "President", department: null },
					reason: "Running for president",
					created_at: "2026-04-24T10:00:00Z",
				},
			],
		});

		const pendingList = screen.getByRole("list", { name: "Pending review" });
		const items = within(pendingList).getAllByRole("listitem");
		expect(items).toHaveLength(2);
		// Newest first, each with its own requested role and status.
		expect(within(items[0]).getByText("Vice-President")).toBeInTheDocument();
		expect(within(items[0]).getByText("Pending")).toBeInTheDocument();
		expect(within(items[1]).getByText("President")).toBeInTheDocument();
		expect(within(items[1]).getByText("Pending")).toBeInTheDocument();
		expect(
			screen.getByText("Reason: Running for president"),
		).toBeInTheDocument();
	});

	it("lists reviewed requests below pending ones with their review note", () => {
		renderSection({
			memberChangeRequests: [
				{
					id: "r-pending",
					user_id: "user-1",
					status: "pending",
					changes: { department: "Research" },
				},
				{
					id: "r-rejected",
					user_id: "user-1",
					status: "rejected",
					changes: { member_role: "Team Lead", department: "Venture" },
					reason: "Leading the venture team",
					review_note: "Needs board confirmation",
				},
				{
					id: "r-approved",
					user_id: "user-1",
					status: "approved",
					changes: { member_status: "alumni" },
				},
			],
		});

		const pending = screen.getByRole("list", { name: "Pending review" });
		expect(within(pending).getAllByRole("listitem")).toHaveLength(1);
		expect(within(pending).getByText("Research")).toBeInTheDocument();

		const reviewed = screen.getByRole("list", { name: "Reviewed" });
		const [rejected, approved] = within(reviewed).getAllByRole("listitem");
		expect(within(rejected).getByText("Rejected")).toBeInTheDocument();
		expect(within(rejected).getByText("Team Lead")).toBeInTheDocument();
		expect(within(rejected).getByText("Venture")).toBeInTheDocument();
		expect(
			within(rejected).getByText("Review note: Needs board confirmation"),
		).toBeInTheDocument();
		expect(within(approved).getByText("Approved")).toBeInTheDocument();
		expect(within(approved).getByText("Alumni")).toBeInTheDocument();
	});

	it("renders no request history when there are no requests", () => {
		renderSection();
		expect(
			screen.queryByRole("heading", { name: "Your requests" }),
		).not.toBeInTheDocument();
	});

	it("disables the button while submitting", () => {
		renderSection({ isSubmittingChangeRequest: true });
		expect(
			screen.getByRole("button", { name: /submitting request/i }),
		).toBeDisabled();
	});
});
