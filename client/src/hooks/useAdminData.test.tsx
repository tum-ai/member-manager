import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useAdminData } from "./useAdminData";

vi.mock("../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

function membersPage(page: number, data: unknown[], total: number) {
	return HttpResponse.json({ data, total, page, limit: 200 });
}

describe("useAdminData", () => {
	it("loads members, change/certificate/job requests", async () => {
		server.use(
			http.get("/api/admin/members", () =>
				membersPage(1, [{ user_id: "m-1" }, { user_id: "m-2" }], 2),
			),
			http.get("/api/admin/member-change-requests", () =>
				HttpResponse.json([{ id: "cr-1" }]),
			),
			http.get("/api/admin/engagement-certificate-requests", () =>
				HttpResponse.json([{ id: "ec-1" }]),
			),
			http.get("/api/admin/job-requests", () =>
				HttpResponse.json([{ id: "job-1" }]),
			),
		);

		const { result } = renderHookWithClient(() => useAdminData());

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await waitFor(() => expect(result.current.members?.length).toBe(2));
		expect(result.current.totalMembers).toBe(2);
		// The three side queries settle independently of the members query, so
		// wait on each rather than asserting against the `?? []` fallback.
		await waitFor(() =>
			expect(result.current.changeRequests).toEqual([{ id: "cr-1" }]),
		);
		await waitFor(() =>
			expect(result.current.certificateRequests).toEqual([{ id: "ec-1" }]),
		);
		await waitFor(() =>
			expect(result.current.jobRequests).toEqual([{ id: "job-1" }]),
		);
	});

	it("PATCHes the department endpoint", async () => {
		let capturedUrl: string | null = null;
		let capturedBody: unknown = null;
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.patch(
				"/api/admin/members/:userId/department",
				async ({ request }) => {
					capturedUrl = request.url;
					capturedBody = await request.json();
					return new HttpResponse(null, { status: 204 });
				},
			),
		);

		const { result } = renderHookWithClient(() => useAdminData());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.updateDepartmentAsync({
			userId: "m-1",
			department: "tech",
		});

		await waitFor(() => expect(capturedUrl).not.toBeNull());
		expect(capturedUrl).toContain("/api/admin/members/m-1/department");
		expect(capturedBody).toEqual({ department: "tech" });
	});

	it("PATCHes a job request review decision", async () => {
		let body: unknown = null;
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.patch("/api/admin/job-requests/:id", async ({ request }) => {
				body = await request.json();
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() => useAdminData());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.reviewJobRequestAsync({
			requestId: "job-1",
			decision: "approved",
			review_note: "ok",
		});

		await waitFor(() => expect(body).not.toBeNull());
		expect(body).toEqual({ decision: "approved", review_note: "ok" });
	});
});
