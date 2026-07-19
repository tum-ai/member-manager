import type { JobPostingRequest } from "@member-manager/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminJobRequestCard } from "./AdminJobRequestCard";

const request: JobPostingRequest = {
	id: "job-1",
	user_id: "member-1",
	status: "pending",
	title: "AI Engineer",
	organization_name: "Example GmbH",
	logo_url: null,
	description_markdown:
		"Build production AI systems with our engineering team. ".repeat(12),
	call_to_action: "Apply now",
	job_type: "full_time",
	location: "Munich",
	contact_name: "Taylor Example",
	contact_email: "jobs@example.com",
	contact_role: null,
	external_url: null,
	expires_at: null,
};

describe("AdminJobRequestCard", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("closes the detail dialog before handing off to the editor", async () => {
		vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
		const user = userEvent.setup();
		const onEdit = vi.fn();
		render(
			<AdminJobRequestCard
				request={request}
				requesterName="Taylor Example"
				isActionPending={false}
				onEdit={onEdit}
				onRemove={() => {}}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Read more" }));
		const dialog = screen.getByRole("dialog");
		await user.click(
			within(dialog).getByRole("button", {
				name: "Edit job posting AI Engineer",
			}),
		);

		expect(onEdit).toHaveBeenCalledOnce();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
