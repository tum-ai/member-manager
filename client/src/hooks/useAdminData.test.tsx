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

	it("paginates through every members page", async () => {
		const firstPage = Array.from({ length: 200 }, (_, i) => ({
			user_id: `m-${i}`,
		}));
		server.use(
			http.get("/api/admin/members", ({ request }) => {
				const page = Number(new URL(request.url).searchParams.get("page"));
				if (page === 1) {
					return membersPage(1, firstPage, 201);
				}
				return membersPage(2, [{ user_id: "m-200" }], 201);
			}),
		);

		const { result } = renderHookWithClient(() => useAdminData());

		await waitFor(() => expect(result.current.members?.length).toBe(201));
		expect(result.current.totalMembers).toBe(201);
		expect(result.current.members?.at(-1)).toEqual({ user_id: "m-200" });
	});

	it("stops paginating when a full first page already covers the total", async () => {
		server.use(
			http.get("/api/admin/members", () =>
				membersPage(1, [{ user_id: "m-1" }], 1),
			),
		);

		const { result } = renderHookWithClient(() => useAdminData());

		await waitFor(() => expect(result.current.members?.length).toBe(1));
		expect(result.current.isLoadingMoreMembers).toBe(false);
	});

	it("aggregates a side-query error into the shared error field", async () => {
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.get("/api/admin/member-change-requests", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useAdminData());

		await waitFor(() => expect(result.current.error).toBeTruthy());
	});

	it("PATCHes role, status, and access-role endpoints", async () => {
		const calls: Record<string, unknown> = {};
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.patch("/api/admin/members/:userId/role", async ({ request }) => {
				calls.role = await request.json();
				return new HttpResponse(null, { status: 204 });
			}),
			http.patch("/api/admin/members/:userId/status", async ({ request }) => {
				calls.status = await request.json();
				return new HttpResponse(null, { status: 204 });
			}),
			http.patch(
				"/api/admin/members/:userId/access-role",
				async ({ request }) => {
					calls.access = await request.json();
					return new HttpResponse(null, { status: 204 });
				},
			),
		);

		const { result } = renderHookWithClient(() => useAdminData());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.updateRoleAsync({
			userId: "m-1",
			member_role: "member",
		});
		await result.current.updateStatusAsync({
			userId: "m-1",
			member_status: "active",
		});
		await result.current.updateAccessRoleAsync({
			userId: "m-1",
			access_role: "admin",
		});

		await waitFor(() => expect(Object.keys(calls)).toHaveLength(3));
		expect(calls.role).toEqual({ member_role: "member" });
		expect(calls.status).toEqual({ member_status: "active" });
		expect(calls.access).toEqual({ access_role: "admin" });
	});

	it("PATCHes the full member endpoint", async () => {
		let body: unknown = null;
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.patch("/api/admin/members/:userId", async ({ request }) => {
				body = await request.json();
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() => useAdminData());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.updateMemberAsync({
			userId: "m-1",
			department: "tech",
			member_role: "member",
			board_role: null,
			member_status: "active",
			access_role: "user",
			batch: "2026",
			research_project_id: null,
			linkedin_profile_url: null,
			public_location: "Munich",
		});

		await waitFor(() => expect(body).not.toBeNull());
		expect(body).toMatchObject({
			department: "tech",
			member_role: "member",
			batch: "2026",
			public_location: "Munich",
		});
	});

	it("PATCHes change-request and certificate-request reviews", async () => {
		const calls: Record<string, unknown> = {};
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.patch(
				"/api/admin/member-change-requests/:id",
				async ({ request }) => {
					calls.change = await request.json();
					return new HttpResponse(null, { status: 204 });
				},
			),
			http.patch(
				"/api/admin/engagement-certificate-requests/:id",
				async ({ request }) => {
					calls.cert = await request.json();
					return new HttpResponse(null, { status: 204 });
				},
			),
		);

		const { result } = renderHookWithClient(() => useAdminData());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.reviewChangeRequestAsync({
			requestId: "cr-1",
			decision: "rejected",
			review_note: "no",
		});
		await result.current.reviewCertificateRequestAsync({
			requestId: "ec-1",
			decision: "approved",
		});

		await waitFor(() => expect(Object.keys(calls)).toHaveLength(2));
		expect(calls.change).toEqual({ decision: "rejected", review_note: "no" });
		expect(calls.cert).toEqual({ decision: "approved" });
	});

	it("DELETEs a job request", async () => {
		let method: string | null = null;
		server.use(
			http.get("/api/admin/members", () => membersPage(1, [], 0)),
			http.delete("/api/admin/job-requests/:id", ({ request }) => {
				method = request.method;
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() => useAdminData());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.removeJobRequestAsync("job-1");

		await waitFor(() => expect(method).toBe("DELETE"));
	});
});
