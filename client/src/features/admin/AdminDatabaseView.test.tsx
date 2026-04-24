import { ThemeProvider } from "@mui/material";
import { render, screen, waitFor } from "@testing-library/react";
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
					department: "Board",
					member_role: "Team Lead",
				},
			},
		],
		certificateRequests: [
			{
				id: "certificate-1",
				user_id: "member-1",
				status: "pending",
				engagements: [{ id: "engagement-1" }],
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
				department: "Board",
				member_role: "President",
				member_status: "inactive",
				access_role: "admin",
			});
		});
	});

	it("lets admins approve a pending member change request", async () => {
		const user = userEvent.setup();
		renderAdminView();

		await user.click(
			screen.getByRole("button", { name: /approve request-1/i }),
		);

		await waitFor(() => {
			expect(reviewChangeRequestAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				decision: "approved",
			});
		});
	});

	it("shows member names instead of raw ids in request panels", () => {
		renderAdminView();

		expect(screen.getAllByText(/Member: Alice Example/i)).toHaveLength(2);
		expect(
			screen.getByText(/Engagement Certificate Requests/i),
		).toBeInTheDocument();
	});
});
