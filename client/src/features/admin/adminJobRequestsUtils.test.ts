import type { JobPostingRequest } from "@member-manager/shared";
import { describe, expect, it } from "vitest";
import { emptyAdminJobForm, jobRequestToForm } from "./adminJobRequestsUtils";

describe("adminJobRequestsUtils", () => {
	it("provides empty defaults for creating a posting", () => {
		expect(emptyAdminJobForm.job_type).toBe("working_student");
		expect(emptyAdminJobForm.call_to_action).toBe("Apply now");
	});

	it("maps a request into editable form values", () => {
		const request: JobPostingRequest = {
			id: "job-1",
			user_id: "member-1",
			status: "approved",
			title: "AI Engineer",
			organization_name: "Example GmbH",
			logo_url: null,
			description_markdown:
				"Build production AI systems with our engineering team.",
			call_to_action: "Meet the team",
			job_type: "full_time",
			location: "Munich",
			contact_name: "Taylor Example",
			contact_email: "jobs@example.com",
			contact_role: null,
			external_url: null,
			expires_at: "2026-12-31T23:59:59.000Z",
		};

		expect(jobRequestToForm(request)).toEqual({
			title: "AI Engineer",
			organization_name: "Example GmbH",
			logo_url: "",
			description_markdown:
				"Build production AI systems with our engineering team.",
			call_to_action: "Meet the team",
			job_type: "full_time",
			location: "Munich",
			contact_name: "Taylor Example",
			contact_email: "jobs@example.com",
			contact_role: "",
			external_url: "",
			expires_at: "2026-12-31",
		});
	});
});
