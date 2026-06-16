import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminChangeRequestsPage from "./AdminChangeRequestsPage";

const { reviewChangeRequestAsync } = vi.hoisted(() => ({
	reviewChangeRequestAsync: vi.fn(),
}));

vi.mock("../../hooks/useAdminData", () => ({
	useAdminData: () => ({
		members: [
			{
				user_id: "member-1",
				given_name: "Alice",
				surname: "Example",
				department: "Software Development",
				member_role: "Member",
				member_status: "active",
				active: true,
			},
		],
		changeRequests: [
			{
				id: "request-1",
				user_id: "member-1",
				status: "pending",
				reason: "Changed responsibilities",
				changes: { department: "Venture", member_role: "Team Lead" },
			},
		],
		isLoading: false,
		error: null,
		reviewChangeRequestAsync,
		isReviewingChangeRequest: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

describe("AdminChangeRequestsPage", () => {
	it("shows member names and readable change diffs", () => {
		render(<AdminChangeRequestsPage />);

		expect(screen.getByText(/Member: Alice Example/i)).toBeInTheDocument();
		expect(
			screen.getByText(
				/requested changes: department: software development -> venture, role: member -> team lead/i,
			),
		).toBeInTheDocument();
	});

	it("lets admins approve a pending change request", async () => {
		const user = userEvent.setup();
		render(<AdminChangeRequestsPage />);

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
});
