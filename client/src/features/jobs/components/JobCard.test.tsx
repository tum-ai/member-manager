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

	it("anchors the stretched overlay to the card root, not the description wrapper", () => {
		// jsdom can't hit-test the `after:inset-0` overlay, so we guard the DOM
		// structure instead: the overlay's containing block must be the GlassCard
		// root so the whole card is clickable. If anyone re-introduces a positioned
		// wrapper (`relative`) between the overlay button and the card root, the
		// overlay would shrink to that wrapper and this test must fail.
		render(<JobCard job={makeJob()} />);

		const trigger = screen.getByRole("button", { name: /view details for/i });
		// The overlay is implemented as the button's `after` pseudo-element.
		expect(trigger).toHaveClass("after:absolute", "after:inset-0");

		const cardRoot = document.querySelector<HTMLElement>(
			'[data-slot="glass-card"]',
		);
		expect(cardRoot).not.toBeNull();
		expect(cardRoot).toHaveClass("relative");

		// Walk from the button up to the card root; no element in between may be a
		// positioned containing block (`relative`), or it would capture inset-0.
		let node = trigger.parentElement;
		while (node && node !== cardRoot) {
			expect(node).not.toHaveClass("relative");
			node = node.parentElement;
		}
		// The card root is reached, so it is the overlay's containing block.
		expect(node).toBe(cardRoot);
	});

	it("does not open the dialog when the Apply link is clicked", async () => {
		const user = userEvent.setup();
		render(<JobCard job={makeJob()} />);

		const applyLink = screen.getByRole("link", { name: /apply now/i });
		expect(applyLink).toHaveAttribute("href", "https://example.com/jobs/ml");
		await user.click(applyLink);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("keeps the stacking context on the Apply anchor itself, not the wrapper", () => {
		// The Apply anchor must carry `relative z-10` directly so it stacks above
		// the card-wide overlay at every breakpoint. Its wrapper uses `sm:contents`
		// (display: contents), which generates no box at sm+ and therefore cannot
		// host a stacking context — so the positioning must live on the anchor.
		// jsdom can't test paint order, so we assert the class contract here.
		render(<JobCard job={makeJob()} />);

		const applyLink = screen.getByRole("link", { name: /apply now/i });
		expect(applyLink).toHaveClass("relative", "z-10");
	});
});
