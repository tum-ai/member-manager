import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PartnerJob } from "@/hooks/useJobs";
import { JobCard } from "./JobCard";

function makeJob(overrides: Partial<PartnerJob> = {}): PartnerJob {
	return {
		id: "job-1",
		title: "ML Engineer Intern",
		partner: { name: "Example Partner", logo_url: null },
		logo_url: null,
		description_markdown: "Build useful models.",
		call_to_action: "Apply now",
		job_type: "internship",
		location: "Munich",
		contact: { name: "Dr. Example", email: "jobs@example.com", role: "Talent" },
		external_url: "https://example.com/jobs/ml",
		published_at: "2026-05-20T10:00:00.000Z",
		expires_at: null,
		...overrides,
	};
}

describe("JobCard", () => {
	it("opens the detail dialog when the card overlay is clicked", async () => {
		const user = userEvent.setup();
		render(<JobCard job={makeJob()} />);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /view details for/i }));

		expect(await screen.findByRole("dialog")).toBeInTheDocument();
	});

	it("opens the dialog via keyboard (Enter) on the focused button", async () => {
		const user = userEvent.setup();
		render(<JobCard job={makeJob()} />);

		const trigger = screen.getByRole("button", { name: /view details for/i });
		trigger.focus();
		expect(trigger).toHaveFocus();
		await user.keyboard("{Enter}");

		expect(await screen.findByRole("dialog")).toBeInTheDocument();
	});

	it("opens the dialog via keyboard (Space) on the focused button", async () => {
		const user = userEvent.setup();
		render(<JobCard job={makeJob()} />);

		const trigger = screen.getByRole("button", { name: /view details for/i });
		trigger.focus();
		await user.keyboard(" ");

		expect(await screen.findByRole("dialog")).toBeInTheDocument();
	});

	it("does not open the dialog when the Apply link is clicked", async () => {
		const user = userEvent.setup();
		render(<JobCard job={makeJob()} />);

		const applyLink = screen.getByRole("link", { name: /apply now/i });
		expect(applyLink).toHaveAttribute("href", "https://example.com/jobs/ml");
		await user.click(applyLink);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
