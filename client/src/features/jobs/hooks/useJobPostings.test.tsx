import { act, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSubmissionFormState } from "@/features/jobs/jobPostingsUtils";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useJobPostings } from "./useJobPostings";

const showToast = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

function makeFormEvent(): React.FormEvent<HTMLFormElement> {
	return {
		preventDefault: vi.fn(),
	} as unknown as React.FormEvent<HTMLFormElement>;
}

function fillForm(
	update: (field: keyof JobSubmissionFormState, value: string) => void,
	fields: Partial<Record<keyof JobSubmissionFormState, string>>,
) {
	for (const [field, value] of Object.entries(fields)) {
		update(field as keyof JobSubmissionFormState, value);
	}
}

describe("useJobPostings", () => {
	beforeEach(() => {
		showToast.mockClear();
		server.use(
			http.get("/api/jobs", () =>
				HttpResponse.json({ data: [], next_cursor: null }),
			),
			http.get("/api/jobs/requests", () => HttpResponse.json([])),
		);
	});

	it("opens and closes the submission dialog", async () => {
		const { result } = renderHookWithClient(() => useJobPostings());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.isSubmissionDialogOpen).toBe(false);
		act(() => result.current.openSubmissionDialog());
		expect(result.current.isSubmissionDialogOpen).toBe(true);
		act(() => result.current.closeSubmissionDialog());
		expect(result.current.isSubmissionDialogOpen).toBe(false);
	});

	it("updates the form via updateJobForm", async () => {
		const { result } = renderHookWithClient(() => useJobPostings());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.updateJobForm("title", "Robotics Intern"));
		expect(result.current.jobForm.title).toBe("Robotics Intern");
	});

	it("submits a trimmed payload, toasts success, resets and closes", async () => {
		let received: unknown;
		server.use(
			http.post("/api/jobs/requests", async ({ request }) => {
				received = await request.json();
				return HttpResponse.json({ id: "req-1" });
			}),
		);

		const { result } = renderHookWithClient(() => useJobPostings());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.openSubmissionDialog());
		act(() =>
			fillForm(result.current.updateJobForm, {
				title: "  Robotics Intern  ",
				organization_name: "  Applied Robotics Lab  ",
				location: "  Garching  ",
				description_markdown: "  Support eval.  ",
				external_url: "https://jobs.test",
				contact_name: "  Maya Chen  ",
				contact_email: "  maya@example.com  ",
			}),
		);

		await act(async () => {
			await result.current.submitJobRequest(makeFormEvent());
		});

		expect(received).toEqual({
			title: "Robotics Intern",
			organization_name: "Applied Robotics Lab",
			logo_url: null,
			description_markdown: "Support eval.",
			call_to_action: "Apply now",
			job_type: "working_student",
			location: "Garching",
			contact_name: "Maya Chen",
			contact_email: "maya@example.com",
			contact_role: null,
			external_url: "https://jobs.test",
			expires_at: null,
		});
		expect(showToast).toHaveBeenCalledWith(
			"Job submitted for admin review.",
			"success",
		);
		expect(result.current.isSubmissionDialogOpen).toBe(false);
		expect(result.current.jobForm.title).toBe("");
	});

	it("toasts an error when submission fails", async () => {
		server.use(
			http.post("/api/jobs/requests", () =>
				HttpResponse.json({ error: "Boom" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useJobPostings());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			await result.current.submitJobRequest(makeFormEvent());
		});

		await waitFor(() => {
			expect(showToast).toHaveBeenCalledWith(
				expect.stringContaining("Could not submit job:"),
				"error",
			);
		});
		expect(result.current.isSubmissionDialogOpen).toBe(false);
	});
});
