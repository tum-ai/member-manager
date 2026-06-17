import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminDatabaseView } from "./AdminDatabaseView";

const { updateMemberAsync } = vi.hoisted(() => ({
	updateMemberAsync: vi.fn(),
}));

vi.mock("../../hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({
		researchProjects: [
			{
				id: "project-a",
				title: "Alpha Research",
				description: "Current project",
				status: "ongoing",
			},
		],
		isLoading: false,
		error: null,
	}),
}));

vi.mock("../../hooks/useAdminData", () => ({
	useAdminData: () => ({
		members: [
			{
				user_id: "member-1",
				given_name: "Alice",
				surname: "Example",
				email: "alice@example.com",
				department: "Software Development",
				member_role: "Member",
				board_role: null,
				member_status: "active",
				access_role: "user",
				active: true,
				batch: "WS23",
				research_project_id: null,
				sepa: null,
			},
			{
				user_id: "member-2",
				given_name: "Bob",
				surname: "NoDept",
				email: "bob@example.com",
				department: null,
				member_role: "Member",
				board_role: null,
				member_status: "active",
				access_role: "user",
				active: true,
				batch: null,
				research_project_id: null,
				sepa: null,
			},
		],
		changeRequests: [
			{
				id: "request-1",
				user_id: "member-1",
				status: "pending",
				reason: "Changed responsibilities",
				changes: {
					department: "Venture",
					member_role: "Team Lead",
				},
			},
		],
		certificateRequests: [
			{
				id: "certificate-1",
				user_id: "member-1",
				status: "pending",
				engagements: [
					{
						id: "engagement-1",
						startDate: "2025-10-01",
						endDate: "2026-02-01",
						isStillActive: false,
						weeklyHours: "10",
						department: "Venture",
						isTeamLead: true,
						specialRole: "Board Member",
						tasksDescription: "Built MVP\nRan workshops",
					},
				],
			},
		],
		jobRequests: [
			{
				id: "job-request-1",
				user_id: "member-1",
				status: "pending",
				title: "Founding ML Engineer",
				organization_name: "Member Startup",
				description_markdown:
					"Build production AI systems with the founding team.",
				call_to_action: "Apply now",
				job_type: "full_time",
				location: "Munich",
				contact_name: "Alice Example",
				contact_email: "alice@example.com",
				contact_role: "Founder",
				external_url: "https://example.com/jobs/ml",
				expires_at: null,
			},
		],
		isLoading: false,
		error: null,
		updateMemberAsync,
		isSavingMember: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

vi.mock("../../hooks/useDepartmentPermissions", () => ({
	useDepartmentPermissions: () => ({
		assignments: {},
		isLoading: false,
		saveAssignmentsAsync: vi.fn(),
		isSaving: false,
	}),
}));

function renderAdminView() {
	return render(<AdminDatabaseView />);
}

describe("AdminDatabaseView", () => {
	it("lets admins edit another member's role, department, status, and access", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", { name: /edit member alice example/i }),
		);
		const dialog = within(screen.getByRole("dialog"));
		await user.click(dialog.getByLabelText(/role/i));
		await user.click(await screen.findByRole("option", { name: "President" }));
		await user.click(dialog.getByLabelText(/board member/i));
		await user.click(dialog.getByLabelText(/status/i));
		await user.click(await screen.findByRole("option", { name: "Inactive" }));
		await user.click(dialog.getByLabelText(/access/i));
		await user.click(await screen.findByRole("option", { name: "Admin" }));
		await user.click(
			screen.getByRole("button", { name: /save member changes/i }),
		);

		await waitFor(() => {
			expect(updateMemberAsync).toHaveBeenCalledWith({
				userId: "member-1",
				department: null,
				member_role: "President",
				board_role: "Board Member",
				member_status: "inactive",
				access_role: "admin",
				batch: "WS23",
				research_project_id: null,
				linkedin_profile_url: null,
				public_location: null,
			});
		});
	}, 30_000);

	it("requires a department for member and team lead roles", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", { name: /edit member alice example/i }),
		);
		await user.click(
			within(screen.getByRole("dialog")).getByLabelText(/department/i),
		);
		await user.click(await screen.findByRole("option", { name: "None" }));

		expect(
			await screen.findByText(
				/select a department for member and team lead roles/i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /save member changes/i }),
		).toBeDisabled();
	});

	it("lets admins save batch changes for members without a department when the role is unchanged", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", { name: /edit member bob nodept/i }),
		);
		expect(
			await screen.findByText(
				/keep the role unchanged to save this profile update/i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /save member changes/i }),
		).not.toBeDisabled();

		await user.click(screen.getByLabelText(/batch/i));
		await user.click(await screen.findByRole("option", { name: "SS25" }));
		await user.click(
			screen.getByRole("button", { name: /save member changes/i }),
		);

		await waitFor(() => {
			expect(updateMemberAsync).toHaveBeenCalledWith({
				userId: "member-2",
				department: null,
				member_role: "Member",
				board_role: null,
				member_status: "active",
				access_role: "user",
				batch: "SS25",
				research_project_id: null,
				linkedin_profile_url: null,
				public_location: null,
			});
		});
	});

	it("offers Research but not Board as a department", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", { name: /edit member alice example/i }),
		);
		await user.click(
			within(screen.getByRole("dialog")).getByLabelText(/department/i),
		);

		expect(
			screen.queryByRole("option", { name: "Board" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Research" }),
		).toBeInTheDocument();
	});

	it("does not show raw request ids in the members table", () => {
		renderAdminView();

		expect(screen.queryByText(/request-1/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/certificate-1/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/job-request-1/i)).not.toBeInTheDocument();
	});
});
