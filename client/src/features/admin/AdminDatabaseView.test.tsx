import { ThemeProvider } from "@mui/material";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import AdminDatabaseView from "./AdminDatabaseView";

const {
	updateMemberAsync,
	reviewChangeRequestAsync,
	reviewCertificateRequestAsync,
} = vi.hoisted(() => ({
	updateMemberAsync: vi.fn(),
	reviewChangeRequestAsync: vi.fn(),
	reviewCertificateRequestAsync: vi.fn(),
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
						tasksDescription: "Built MVP\nRan workshops",
					},
				],
			},
		],
		isLoading: false,
		error: null,
		updateMemberAsync,
		reviewChangeRequestAsync,
		reviewCertificateRequestAsync,
		isSavingMember: false,
		isReviewingChangeRequest: false,
		isReviewingCertificateRequest: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

function renderAdminView() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<AdminDatabaseView />
		</ThemeProvider>,
	);
}

describe("AdminDatabaseView", () => {
	it("lets admins edit another member's role, department, status, and access", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(screen.getByRole("button", { name: /edit member/i }));
		await user.click(screen.getByLabelText(/role/i));
		await user.click(await screen.findByRole("option", { name: "President" }));
		await user.click(screen.getByLabelText(/board member/i));
		await user.click(screen.getByLabelText(/status/i));
		await user.click(await screen.findByRole("option", { name: "Inactive" }));
		await user.click(screen.getByLabelText(/access/i));
		await user.click(await screen.findByRole("option", { name: "Admin" }));
		await user.click(
			screen.getByRole("button", { name: /save member changes/i }),
		);

		await waitFor(() => {
			expect(updateMemberAsync).toHaveBeenCalledWith({
				userId: "member-1",
				department: "Software Development",
				member_role: "President",
				board_role: "Board Member",
				member_status: "inactive",
				access_role: "admin",
			});
		});
	}, 10_000);

	it("does not offer Board or Research as operational departments", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(screen.getByRole("button", { name: /edit member/i }));
		await user.click(screen.getByLabelText(/department/i));

		expect(
			screen.queryByRole("option", { name: "Board" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Research" }),
		).not.toBeInTheDocument();
	});

	it("lets admins approve a pending member change request", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", {
				name: /approve change request for alice example/i,
			}),
		);

		await waitFor(() => {
			expect(reviewChangeRequestAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				decision: "approved",
			});
		});
	});

	it("shows member names and readable change diffs in request panels", () => {
		renderAdminView();

		expect(screen.getAllByText(/Member: Alice Example/i)).toHaveLength(2);
		expect(
			screen.getByText(
				/requested changes: department: software development -> venture, role: member -> team lead/i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Engagement Certificate Requests/i),
		).toBeInTheDocument();
	});

	it("lets admins inspect the engagement certificate details", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", {
				name: /view engagement certificate details for alice example/i,
			}),
		);

		const dialog = await screen.findByRole("dialog", {
			name: /engagement certificate request for alice example/i,
		});
		expect(dialog).toBeInTheDocument();
		expect(within(dialog).getByText(/start date/i)).toBeInTheDocument();
		expect(within(dialog).getByText("2025-10-01")).toBeInTheDocument();
		expect(within(dialog).getByText(/end date/i)).toBeInTheDocument();
		expect(within(dialog).getByText("2026-02-01")).toBeInTheDocument();
		expect(within(dialog).getByText(/weekly hours/i)).toBeInTheDocument();
		expect(within(dialog).getByText("10 hours")).toBeInTheDocument();
		expect(within(dialog).getByText("Venture")).toBeInTheDocument();
		expect(within(dialog).getByText("Team Lead")).toBeInTheDocument();
		expect(within(dialog).getByText(/built mvp/i)).toBeInTheDocument();
		expect(within(dialog).getByText(/ran workshops/i)).toBeInTheDocument();
	});

	it("does not show raw request ids in the admin request UI", () => {
		renderAdminView();

		expect(screen.queryByText(/request-1/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/certificate-1/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /approve request-1/i }),
		).not.toBeInTheDocument();
	});

	it("keeps the members table above the pending request panels", () => {
		renderAdminView();

		const membersHeading = screen.getByRole("heading", { name: /^members$/i });
		const changeRequestsHeading = screen.getByRole("heading", {
			name: /member change requests/i,
		});
		const certificateRequestsHeading = screen.getByRole("heading", {
			name: /engagement certificate requests/i,
		});

		expect(membersHeading.compareDocumentPosition(changeRequestsHeading)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		expect(
			membersHeading.compareDocumentPosition(certificateRequestsHeading),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});
});
