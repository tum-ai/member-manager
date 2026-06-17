import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReimbursementRequest } from "../features/reimbursements/reimbursementTypes";
import { HttpResponse, http, server } from "../test/mswServer";
import { renderHookWithClient } from "../test/renderWithClient";
import { useReimbursementRequests } from "./useReimbursementRequests";

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

const sampleRequest: Partial<ReimbursementRequest> = {
	id: "req-1",
	user_id: "user-1",
	amount: 42,
	description: "Train ticket",
};

describe("useReimbursementRequests", () => {
	it("fetches requests from /api/reimbursements", async () => {
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([sampleRequest])),
		);

		const { result } = renderHookWithClient(() =>
			useReimbursementRequests("user-1"),
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.requests).toHaveLength(1);
		expect(result.current.requests[0]?.id).toBe("req-1");
	});

	it("POSTs the payload when creating a request", async () => {
		let body: unknown = null;
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([])),
			http.post("/api/reimbursements", async ({ request }) => {
				body = await request.json();
				return HttpResponse.json(sampleRequest);
			}),
		);

		const { result } = renderHookWithClient(() =>
			useReimbursementRequests("user-1"),
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.createRequestAsync({
			amount: 42,
			date: "2026-01-01",
			description: "Train ticket",
			department: "tech",
			submission_type: "reimbursement",
			receipt_filename: "r.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "AAAA",
		});

		await waitFor(() => expect(body).not.toBeNull());
		expect(body).toMatchObject({ amount: 42, department: "tech" });
	});

	it("POSTs to /api/reimbursements/parse-receipt", async () => {
		let parsed = false;
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([])),
			http.post("/api/reimbursements/parse-receipt", () => {
				parsed = true;
				return HttpResponse.json({
					amount: 10,
					date: null,
					description: null,
					payment_iban: null,
					payment_bic: null,
				});
			}),
		);

		const { result } = renderHookWithClient(() =>
			useReimbursementRequests("user-1"),
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		const out = await result.current.parseReceiptAsync({
			receipt_filename: "r.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "AAAA",
		});

		expect(parsed).toBe(true);
		expect(out.amount).toBe(10);
	});
});
