import type { JobPostingRequest } from "@member-manager/shared";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useAdminJobRequests } from "./useAdminJobRequests";

const approvedJob: JobPostingRequest = {
	id: "job-1",
	user_id: "member-1",
	status: "approved",
	title: "AI Engineer",
	organization_name: "Example GmbH",
	logo_url: null,
	description_markdown:
		"Build production AI systems with our engineering team.",
	call_to_action: "Apply now",
	job_type: "full_time",
	location: "Munich",
	contact_name: "Taylor Example",
	contact_email: "jobs@example.com",
	contact_role: null,
	external_url: null,
	expires_at: null,
};

const {
	adminState,
	createJobAsync,
	updateJobAsync,
	reviewJobRequestAsync,
	removeJobRequestAsync,
	showToast,
} = vi.hoisted(() => ({
	adminState: {
		isSavingJob: false,
		jobRequests: [] as JobPostingRequest[],
	},
	createJobAsync: vi.fn(),
	updateJobAsync: vi.fn(),
	reviewJobRequestAsync: vi.fn(),
	removeJobRequestAsync: vi.fn(),
	showToast: vi.fn(),
}));

vi.mock("@/hooks/useAdminData", () => ({
	useAdminData: () => ({
		members: [],
		jobRequests: adminState.jobRequests,
		isLoading: false,
		error: null,
		createJobAsync,
		updateJobAsync,
		reviewJobRequestAsync,
		removeJobRequestAsync,
		isSavingJob: adminState.isSavingJob,
	}),
}));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

const validJob = {
	title: "AI Platform Engineer",
	organization_name: "TUM.ai",
	logo_url: "",
	description_markdown:
		"Build and operate the platform used by our applied AI teams.",
	call_to_action: "Apply now",
	job_type: "full_time" as const,
	location: "Munich",
	contact_name: "Admin User",
	contact_email: "jobs@tum-ai.com",
	contact_role: "",
	external_url: "",
	expires_at: "",
};

describe("useAdminJobRequests", () => {
	beforeEach(() => {
		adminState.isSavingJob = false;
		adminState.jobRequests = [approvedJob];
		createJobAsync.mockReset();
		updateJobAsync.mockReset();
		reviewJobRequestAsync.mockReset();
		removeJobRequestAsync.mockReset();
		showToast.mockReset();
	});

	it("does not let an earlier save close a newly opened editor", async () => {
		let resolveCreate: (() => void) | undefined;
		createJobAsync.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveCreate = resolve;
				}),
		);
		const { result } = renderHookWithClient(() => useAdminJobRequests());

		act(() => {
			result.current.openCreate();
			result.current.form.reset(validJob);
		});
		act(() => {
			void result.current.submitEditor();
		});
		await waitFor(() => expect(createJobAsync).toHaveBeenCalledOnce());

		act(() => {
			result.current.openEdit(approvedJob);
		});
		expect(result.current.editorMode).toBe("edit");

		act(() => resolveCreate?.());
		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Job posting published",
				"success",
			),
		);
		expect(result.current.editorMode).toBe("edit");
		expect(result.current.form.getValues("title")).toBe("AI Engineer");
	});

	it("does not close the editor while a save is pending", () => {
		const { result, rerender } = renderHookWithClient(() =>
			useAdminJobRequests(),
		);

		act(() => result.current.openCreate());
		adminState.isSavingJob = true;
		rerender();
		act(() => result.current.closeEditor());

		expect(result.current.editorMode).toBe("create");
	});
});
