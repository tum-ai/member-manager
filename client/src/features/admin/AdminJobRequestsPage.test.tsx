import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminJobRequestsPage from "./AdminJobRequestsPage";

const { reviewJobRequestAsync } = vi.hoisted(() => ({
	reviewJobRequestAsync: vi.fn(),
}));

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
		jobRequests: [
			{
				id: "job-request-1",
				user_id: "member-1",
				status: "pending",
				title: "Founding ML Engineer",
				organization_name: "Member Startup",
				description_markdown: "Build production AI systems.",
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
		reviewJobRequestAsync,
		isReviewingJobRequest: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

describe("AdminJobRequestsPage", () => {
	it("shows the pending job posting", () => {
		render(<AdminJobRequestsPage />);

		expect(screen.getByText(/Founding ML Engineer/i)).toBeInTheDocument();
		expect(screen.getByText(/Member: Alice Example/i)).toBeInTheDocument();
	});

	it("lets admins approve a pending job posting request", async () => {
		const user = userEvent.setup();
		render(<AdminJobRequestsPage />);

		await user.click(
			screen.getByRole("button", {
				name: /approve job posting request for alice example/i,
			}),
		);

		await waitFor(() => {
			expect(reviewJobRequestAsync).toHaveBeenCalledWith({
				requestId: "job-request-1",
				decision: "approved",
			});
		});
	});
});
