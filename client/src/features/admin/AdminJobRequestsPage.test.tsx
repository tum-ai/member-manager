import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminJobRequestsPage from "./AdminJobRequestsPage";

const { reviewJobRequestAsync, removeJobRequestAsync } = vi.hoisted(() => ({
	reviewJobRequestAsync: vi.fn(),
	removeJobRequestAsync: vi.fn(),
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
				source: "member_manager",
			},
			{
				id: "job-request-2",
				user_id: null,
				status: "pending",
				title: "Partner Data Scientist",
				organization_name: "Partner Corp",
				description_markdown: "Join our data team.",
				call_to_action: "Apply now",
				job_type: "full_time",
				location: "Berlin",
				contact_name: "Bob Partner",
				contact_email: "bob@partner.com",
				contact_role: "Recruiter",
				external_url: "https://partner.com/jobs/ds",
				expires_at: null,
				source: "partner_portal",
			},
		],
		isLoading: false,
		error: null,
		reviewJobRequestAsync,
		removeJobRequestAsync,
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

	it("labels partner portal submissions", () => {
		render(<AdminJobRequestsPage />);

		expect(screen.getByText("Partner Portal")).toBeInTheDocument();
		expect(
			screen.getByText(/Submitted via: Partner Portal/i),
		).toBeInTheDocument();
	});

	it("removes a job request after confirmation", async () => {
		const user = userEvent.setup();
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
		render(<AdminJobRequestsPage />);

		await user.click(
			screen.getByRole("button", {
				name: /remove job posting request for partner portal/i,
			}),
		);

		await waitFor(() => {
			expect(removeJobRequestAsync).toHaveBeenCalledWith("job-request-2");
		});

		confirmSpy.mockRestore();
	});
});
