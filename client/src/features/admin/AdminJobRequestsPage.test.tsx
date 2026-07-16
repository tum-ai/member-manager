import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminJobRequestsPage from "./AdminJobRequestsPage";

const {
	createJobAsync,
	updateJobAsync,
	reviewJobRequestAsync,
	removeJobRequestAsync,
} = vi.hoisted(() => ({
	createJobAsync: vi.fn(),
	updateJobAsync: vi.fn(),
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
			{
				id: "job-request-3",
				user_id: "member-1",
				status: "approved",
				title: "Published AI Engineer",
				organization_name: "Member Startup",
				description_markdown:
					"Build and operate reliable production AI systems.",
				call_to_action: "Apply now",
				job_type: "full_time",
				location: "Munich",
				contact_name: "Alice Example",
				contact_email: "alice@example.com",
				contact_role: "Founder",
				external_url: "https://example.com/jobs/published",
				expires_at: null,
				source: "member_manager",
			},
		],
		isLoading: false,
		error: null,
		createJobAsync,
		updateJobAsync,
		reviewJobRequestAsync,
		removeJobRequestAsync,
		isReviewingJobRequest: false,
		isSavingJob: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

describe("AdminJobRequestsPage", () => {
	beforeEach(() => {
		createJobAsync.mockReset().mockResolvedValue(undefined);
		updateJobAsync.mockReset().mockResolvedValue(undefined);
		reviewJobRequestAsync.mockReset().mockResolvedValue(undefined);
		removeJobRequestAsync.mockReset().mockResolvedValue(undefined);
	});

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

	it("lets admins create and immediately publish a job posting", async () => {
		const user = userEvent.setup();
		render(<AdminJobRequestsPage />);

		await user.click(screen.getByRole("button", { name: /create job/i }));
		await user.type(
			screen.getByLabelText(/job title/i),
			"AI Platform Engineer",
		);
		await user.type(screen.getByLabelText(/organization/i), "TUM.ai");
		await user.type(screen.getByLabelText(/location/i), "Munich");
		await user.type(
			screen.getByLabelText(/description/i),
			"Build the platform used by our applied AI teams.",
		);
		await user.type(screen.getByLabelText(/contact name/i), "Admin User");
		await user.type(screen.getByLabelText(/contact email/i), "jobs@tum-ai.com");
		await user.click(screen.getByRole("button", { name: /publish job/i }));

		await waitFor(() => {
			expect(createJobAsync).toHaveBeenCalledWith({
				title: "AI Platform Engineer",
				organization_name: "TUM.ai",
				logo_url: null,
				description_markdown:
					"Build the platform used by our applied AI teams.",
				call_to_action: "Apply now",
				job_type: "working_student",
				location: "Munich",
				contact_name: "Admin User",
				contact_email: "jobs@tum-ai.com",
				contact_role: null,
				external_url: null,
				expires_at: null,
			});
		});
	});

	it("lets admins edit a member-submitted job before review", async () => {
		const user = userEvent.setup();
		render(<AdminJobRequestsPage />);

		await user.click(
			screen.getByRole("button", {
				name: /edit job posting founding ml engineer/i,
			}),
		);
		const title = screen.getByLabelText(/job title/i);
		await user.clear(title);
		await user.type(title, "Senior ML Engineer");
		await user.click(screen.getByRole("button", { name: /save changes/i }));

		await waitFor(() => {
			expect(updateJobAsync).toHaveBeenCalledWith({
				requestId: "job-request-1",
				payload: expect.objectContaining({
					title: "Senior ML Engineer",
					organization_name: "Member Startup",
				}),
			});
		});
	});

	it("keeps published jobs available for later edits", async () => {
		const user = userEvent.setup();
		render(<AdminJobRequestsPage />);

		await user.click(screen.getByRole("tab", { name: /managed \(1\)/i }));
		expect(screen.getByText("Published AI Engineer")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", {
				name: /edit job posting published ai engineer/i,
			}),
		);
		const title = screen.getByLabelText(/job title/i);
		await user.clear(title);
		await user.type(title, "Principal AI Engineer");
		await user.click(screen.getByRole("button", { name: /save changes/i }));

		await waitFor(() => {
			expect(updateJobAsync).toHaveBeenCalledWith({
				requestId: "job-request-3",
				payload: expect.objectContaining({
					title: "Principal AI Engineer",
				}),
			});
		});
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
