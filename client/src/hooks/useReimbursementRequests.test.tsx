import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	BuchhaltungsButlerSyncStatus,
	ReimbursementRequest,
	ReimbursementReviewResponse,
} from "@/features/reimbursements/reimbursementTypes";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import {
	useReimbursementRequests,
	useReimbursementReview,
} from "./useReimbursementRequests";

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

	it("surfaces the query error when the fetch fails", async () => {
		server.use(
			http.get("/api/reimbursements", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() =>
			useReimbursementRequests("user-1"),
		);

		await waitFor(() => expect(result.current.error).toBeTruthy());
		expect(result.current.requests).toEqual([]);
	});
});

const reviewRequest: Partial<ReimbursementRequest> = {
	id: "rev-1",
	user_id: "user-2",
	amount: 99,
	receipt_view_url: "/api/reimbursements/review/rev-1/receipt/view",
	receipt_download_url: "/api/reimbursements/review/rev-1/receipt/download",
	receipt_filename: "invoice.pdf",
};

describe("useReimbursementReview", () => {
	let createObjectURL: ReturnType<typeof vi.fn>;
	let revokeObjectURL: ReturnType<typeof vi.fn>;
	let windowOpen: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		createObjectURL = vi.fn(() => "blob:mock");
		revokeObjectURL = vi.fn();
		windowOpen = vi.fn();
		URL.createObjectURL =
			createObjectURL as unknown as typeof URL.createObjectURL;
		URL.revokeObjectURL =
			revokeObjectURL as unknown as typeof URL.revokeObjectURL;
		window.open = windowOpen as unknown as typeof window.open;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("normalizes an array review response (legacy shape)", async () => {
		server.use(
			http.get("/api/reimbursements/review", () =>
				HttpResponse.json([reviewRequest]),
			),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await waitFor(() => expect(result.current.requests).toHaveLength(1));
		expect(result.current.canBulkDownloadReceipts).toBe(true);
		expect(result.current.buchhaltungsButlerSyncStatus).toBeNull();
	});

	it("normalizes an object review response with integrations", async () => {
		const bbStatus: BuchhaltungsButlerSyncStatus = {
			sync_enabled: true,
			configured: true,
			available: true,
		};
		const response: ReimbursementReviewResponse = {
			requests: [reviewRequest as ReimbursementRequest],
			receipt_endpoints: { bulk_download_url: "/custom/bulk-download" },
			integrations: { buchhaltungsbutler: bbStatus },
		};
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json(response)),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());

		await waitFor(() => expect(result.current.requests).toHaveLength(1));
		expect(result.current.canBulkDownloadReceipts).toBe(true);
		expect(result.current.buchhaltungsButlerSyncStatus).toMatchObject({
			configured: true,
		});
	});

	it("prefers the integrations endpoint status when present", async () => {
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({ buchhaltungsbutler: { configured: false } }),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());

		await waitFor(() =>
			expect(result.current.buchhaltungsButlerSyncStatus).toMatchObject({
				configured: false,
			}),
		);
		expect(result.current.isLoadingBuchhaltungsButlerSyncStatus).toBe(false);
	});

	it("PATCHes a review decision and a department update", async () => {
		const bodies: unknown[] = [];
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
			http.patch("/api/reimbursements/review/:id", async ({ request }) => {
				bodies.push(await request.json());
				return HttpResponse.json(reviewRequest);
			}),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.reviewRequestAsync({
			requestId: "rev-1",
			action: "approve",
		});
		await result.current.updateDepartmentAsync({
			requestId: "rev-1",
			department: "ops",
		});

		await waitFor(() => expect(bodies).toHaveLength(2));
		expect(bodies[1]).toEqual({ department: "ops" });
	});

	it("POSTs a BuchhaltungsButler sync with a coerced force flag", async () => {
		let body: unknown = null;
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
			http.post(
				"/api/reimbursements/review/:id/buchhaltungsbutler-sync",
				async ({ request }) => {
					body = await request.json();
					return HttpResponse.json(reviewRequest);
				},
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.syncBuchhaltungsButlerAsync({ requestId: "rev-1" });

		await waitFor(() => expect(body).not.toBeNull());
		expect(body).toEqual({ force: false });
	});

	it("downloads a single receipt as a blob", async () => {
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
			http.get(reviewRequest.receipt_download_url ?? "", () =>
				HttpResponse.arrayBuffer(new ArrayBuffer(4)),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.downloadReceiptAsync(
			reviewRequest as ReimbursementRequest,
		);
		expect(createObjectURL).toHaveBeenCalled();
	});

	it("opens a single receipt in a new tab", async () => {
		vi.useFakeTimers();
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
			http.get(reviewRequest.receipt_view_url ?? "", () =>
				HttpResponse.arrayBuffer(new ArrayBuffer(4)),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.openReceiptAsync(
			reviewRequest as ReimbursementRequest,
		);
		expect(windowOpen).toHaveBeenCalledWith(
			"blob:mock",
			"_blank",
			"noopener,noreferrer",
		);
		vi.advanceTimersByTime(30_000);
		expect(revokeObjectURL).toHaveBeenCalled();
	});

	it("rejects opening a receipt without a view url", async () => {
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await expect(
			result.current.openReceiptAsync({
				...reviewRequest,
				receipt_view_url: null,
			} as ReimbursementRequest),
		).rejects.toThrow("Receipt is not available");
	});

	it("rejects downloading a receipt without a download url", async () => {
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await expect(
			result.current.downloadReceiptAsync({
				...reviewRequest,
				receipt_download_url: null,
			} as ReimbursementRequest),
		).rejects.toThrow("Receipt is not available");
	});

	it("bulk-downloads receipts to a zip when the url is available", async () => {
		let body: unknown = null;
		server.use(
			http.get("/api/reimbursements/review", () =>
				HttpResponse.json([reviewRequest]),
			),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
			http.post(
				"/api/reimbursements/review/receipts/bulk-download",
				async ({ request }) => {
					body = await request.json();
					return HttpResponse.arrayBuffer(new ArrayBuffer(8));
				},
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() =>
			expect(result.current.canBulkDownloadReceipts).toBe(true),
		);

		await result.current.bulkDownloadReceiptsAsync(["rev-1"]);

		await waitFor(() => expect(body).not.toBeNull());
		expect(body).toEqual({ request_ids: ["rev-1"] });
		expect(createObjectURL).toHaveBeenCalled();
	});

	it("propagates a blob fetch error message", async () => {
		server.use(
			http.get("/api/reimbursements/review", () => HttpResponse.json([])),
			http.get("/api/reimbursements/review/integrations", () =>
				HttpResponse.json({}),
			),
			http.get(reviewRequest.receipt_download_url ?? "", () =>
				HttpResponse.json({ error: "nope" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useReimbursementReview());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await expect(
			result.current.downloadReceiptAsync(
				reviewRequest as ReimbursementRequest,
			),
		).rejects.toThrow();
	});
});
