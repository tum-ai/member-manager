import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import {
	useContractStatusEvents,
	useContractSubmissions,
	useCreateContractSubmission,
	useFinalizeContractSubmission,
} from "./useContractSubmissions";

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

describe("contract submission hooks", () => {
	it("fetches submissions", async () => {
		server.use(
			http.get("/api/contracts/submissions", () =>
				HttpResponse.json([{ id: "sub-1" }]),
			),
		);

		const { result } = renderHookWithClient(() => useContractSubmissions());

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual([{ id: "sub-1" }]);
	});

	it("creates a submission", async () => {
		let body: unknown = null;
		server.use(
			http.post("/api/contracts/submissions", async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ id: "sub-2" });
			}),
		);

		const { result } = renderHookWithClient(() =>
			useCreateContractSubmission(),
		);
		await result.current.mutateAsync({
			template_id: "tmpl-1",
			form_data: { foo: "bar" },
			status: "submitted",
		});

		expect(body).toEqual({
			template_id: "tmpl-1",
			form_data: { foo: "bar" },
			status: "submitted",
		});
	});

	it("fetches status events", async () => {
		server.use(
			http.get("/api/contracts/submissions/sub-1/status-events", () =>
				HttpResponse.json([
					{
						id: "evt-1",
						submission_id: "sub-1",
						from_status: "legal_review",
						to_status: "approved",
						changed_by: null,
						changed_by_name: "Ada Admin",
						note: null,
						created_at: "2026-07-01T00:00:00Z",
					},
				]),
			),
		);

		const { result } = renderHookWithClient(() =>
			useContractStatusEvents("sub-1"),
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.[0]?.to_status).toBe("approved");
	});

	it("refreshes status history after finalization", async () => {
		server.use(
			http.post("/api/contracts/submissions/sub-1/finalize", () =>
				HttpResponse.json({ id: "sub-1", status: "completed" }),
			),
		);
		const { result, queryClient } = renderHookWithClient(() =>
			useFinalizeContractSubmission("sub-1"),
		);
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		await result.current.mutateAsync();

		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["contract-status-events", "sub-1"],
		});
	});
});
