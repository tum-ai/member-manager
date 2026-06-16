import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminCertificateRequestsPage from "./AdminCertificateRequestsPage";

vi.mock("../../hooks/useAdminData", () => ({
	useAdminData: () => ({
		members: [
			{
				user_id: "member-1",
				given_name: "Alice",
				surname: "Example",
				active: true,
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
		isLoading: false,
		error: null,
		reviewCertificateRequestAsync: vi.fn(),
		isReviewingCertificateRequest: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

describe("AdminCertificateRequestsPage", () => {
	it("lets admins inspect the engagement certificate details", async () => {
		const user = userEvent.setup();
		render(<AdminCertificateRequestsPage />);

		await user.click(
			screen.getByRole("button", {
				name: /view engagement certificate details for alice example/i,
			}),
		);

		const dialog = await screen.findByRole("dialog", {
			name: /engagement certificate request for alice example/i,
		});
		expect(within(dialog).getByText(/start date/i)).toBeInTheDocument();
		expect(within(dialog).getByText("2025-10-01")).toBeInTheDocument();
		expect(within(dialog).getByText("2026-02-01")).toBeInTheDocument();
		expect(within(dialog).getByText("10 hours")).toBeInTheDocument();
		expect(within(dialog).getByText("Venture")).toBeInTheDocument();
		expect(
			within(dialog).getByText("Team Lead, Board Member"),
		).toBeInTheDocument();
		expect(within(dialog).getByText(/built mvp/i)).toBeInTheDocument();
		expect(within(dialog).getByText(/ran workshops/i)).toBeInTheDocument();
	});
});
