import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import JobPostingsPage from "./JobPostingsPage";

const { jobsState } = vi.hoisted(() => ({
	jobsState: {
		jobs: [] as unknown[],
		isLoading: false,
		error: null as Error | null,
	},
}));

vi.mock("../../hooks/useJobs", () => ({
	useJobs: () => jobsState,
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
		jobsState.isLoading = false;
		jobsState.error = null;
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
});
