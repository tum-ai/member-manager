import { ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import JobPostingsPage from "./JobPostingsPage";

const { jobsState, submitJobRequestAsync, showToast } = vi.hoisted(() => ({
	jobsState: {
		jobs: [] as unknown[],
		jobRequests: [] as unknown[],
		isLoading: false,
		isLoadingRequests: false,
		error: null as Error | null,
		requestsError: null as Error | null,
		isSubmittingJobRequest: false,
	},
	submitJobRequestAsync: vi.fn(),
	showToast: vi.fn(),
}));

vi.mock("../../hooks/useJobs", () => ({
	useJobs: () => ({
		...jobsState,
		submitJobRequestAsync,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({
		showToast,
	}),
}));

function renderPage() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<JobPostingsPage />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("JobPostingsPage", () => {
	beforeEach(() => {
		jobsState.jobs = [];
		jobsState.jobRequests = [];
		jobsState.isLoading = false;
		jobsState.isLoadingRequests = false;
		jobsState.error = null;
		jobsState.requestsError = null;
		jobsState.isSubmittingJobRequest = false;
		submitJobRequestAsync.mockReset();
		showToast.mockReset();
	});

	it("renders approved partner jobs", () => {
		jobsState.jobs = [
			{
				id: "job-1",
				title: "ML Engineer Intern",
				partner: { name: "Example Partner", logo_url: null },
				logo_url: null,
				description_markdown: "Build useful models.",
				call_to_action: "Apply now",
				job_type: "internship",
				location: "Munich",
				contact: {
					name: "Dr. Example",
					email: "jobs@example.com",
					role: "Talent",
				},
				external_url: "https://example.com/jobs/ml",
				published_at: "2026-05-20T10:00:00.000Z",
				expires_at: null,
			},
		];

		renderPage();

		expect(screen.getByText("ML Engineer Intern")).toBeInTheDocument();
		expect(screen.getByText("Example Partner")).toBeInTheDocument();
		expect(screen.getByText("Build useful models.")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /apply now/i })).toHaveAttribute(
			"href",
			"https://example.com/jobs/ml",
		);
	});

	it("renders an empty state", () => {
		renderPage();

		expect(screen.getByText("No job postings right now")).toBeInTheDocument();
	});

	it("shows member job submissions with review status", () => {
		jobsState.jobRequests = [
			{
				id: "request-1",
				user_id: "user-1",
				status: "pending",
				title: "Founding ML Engineer",
				organization_name: "Member Startup",
				description_markdown:
					"Build production AI systems with the founding team.",
				call_to_action: "Apply now",
				job_type: "full_time",
				location: "Munich",
				contact_name: "Maya",
				contact_email: "maya@example.com",
				external_url: null,
			},
		];

		renderPage();

		expect(screen.getByText("Founding ML Engineer")).toBeInTheDocument();
		expect(screen.getByText(/member startup/i)).toBeInTheDocument();
		expect(screen.getByText("pending")).toBeInTheDocument();
	});

	it("lets members submit a job for review", async () => {
		submitJobRequestAsync.mockResolvedValue({});
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: /post job/i }));
		fireEvent.change(screen.getByLabelText(/job title/i), {
			target: { value: "Robotics Intern" },
		});
		fireEvent.change(screen.getByLabelText(/organization/i), {
			target: { value: "Applied Robotics Lab" },
		});
		fireEvent.change(screen.getByLabelText(/location/i), {
			target: { value: "Garching" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: {
				value:
					"Support model evaluation and deployment for robotics workloads.",
			},
		});
		fireEvent.change(screen.getByLabelText(/apply link/i), {
			target: { value: "https://jobs.test" },
		});
		fireEvent.change(screen.getByLabelText(/contact name/i), {
			target: { value: "Maya Chen" },
		});
		fireEvent.change(screen.getByLabelText(/contact email/i), {
			target: { value: "maya@example.com" },
		});

		fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

		await waitFor(() => {
			expect(submitJobRequestAsync).toHaveBeenCalledWith({
				title: "Robotics Intern",
				organization_name: "Applied Robotics Lab",
				logo_url: null,
				description_markdown:
					"Support model evaluation and deployment for robotics workloads.",
				call_to_action: "Apply now",
				job_type: "working_student",
				location: "Garching",
				contact_name: "Maya Chen",
				contact_email: "maya@example.com",
				contact_role: null,
				external_url: "https://jobs.test",
				expires_at: null,
			});
		});
		await waitFor(() => {
			expect(showToast).toHaveBeenCalledWith(
				"Job submitted for admin review.",
				"success",
			);
		});
	});
});
