import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DepartmentReimbursementsResponse } from "@/features/reimbursements/reimbursementTypes";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useDepartmentReimbursements } from "./useDepartmentReimbursements";

vi.mock("../../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const response: DepartmentReimbursementsResponse = {
	department: "Makeathon",
	requests: [
		{
			id: "department-1",
			requester_name: "Ada Lovelace",
			is_own: false,
			amount: 480,
			date: "2026-04-18",
			description: "Venue deposit",
			submission_type: "invoice",
			status: "requested",
			approval_status: "pending",
			first_approved_at: null,
			payment_status: "to_be_paid",
			created_at: "2026-04-18T10:00:00Z",
		},
	],
};

describe("useDepartmentReimbursements", () => {
	it("loads the department and its requests", async () => {
		server.use(
			http.get("/api/reimbursements/department", () =>
				HttpResponse.json(response),
			),
		);

		const { result } = renderHookWithClient(() =>
			useDepartmentReimbursements("user-1"),
		);

		expect(result.current.isLoading).toBe(true);
		expect(result.current.department).toBeNull();
		expect(result.current.requests).toEqual([]);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.department).toBe("Makeathon");
		expect(result.current.requests).toEqual(response.requests);
		expect(result.current.error).toBeNull();
	});

	it("reloads when the member's own requests are invalidated", async () => {
		let calls = 0;
		server.use(
			http.get("/api/reimbursements/department", () => {
				calls += 1;
				return HttpResponse.json(response);
			}),
		);

		const { result, queryClient } = renderHookWithClient(() =>
			useDepartmentReimbursements("user-1"),
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// The key submitting a request invalidates (`useReimbursementRequests`).
		await queryClient.invalidateQueries({
			queryKey: ["reimbursement-requests", "user-1"],
		});

		await waitFor(() => expect(calls).toBe(2));
	});

	it("reports a failed load", async () => {
		server.use(
			http.get("/api/reimbursements/department", () =>
				HttpResponse.json({ error: "Database unavailable" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() =>
			useDepartmentReimbursements("user-1"),
		);

		await waitFor(() => expect(result.current.error).toBeTruthy());
		expect(result.current.requests).toEqual([]);
	});
});
