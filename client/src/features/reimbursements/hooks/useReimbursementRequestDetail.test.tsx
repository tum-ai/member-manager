import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useReimbursementRequestDetail } from "./useReimbursementRequestDetail";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

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

const ownRequest: ReimbursementRequest = {
	id: "req-1",
	user_id: "user-1",
	amount: 42,
	date: "2026-04-12",
	description: "Train ticket",
	department: "Community",
	submission_type: "reimbursement",
	status: "requested",
	approval_status: "pending",
	payment_status: "to_be_paid",
	receipt_filename: "train.pdf",
	receipt_view_url: "/api/reimbursements/req-1/receipt",
	receipt_download_url: "/api/reimbursements/req-1/receipt?download=1",
};

describe("useReimbursementRequestDetail", () => {
	let windowOpen: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		showToast.mockReset();
		windowOpen = vi.fn();
		window.open = windowOpen as unknown as typeof window.open;
		URL.createObjectURL = vi.fn(
			() => "blob:own",
		) as unknown as typeof URL.createObjectURL;
		URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function renderDetailHook() {
		const rendered = renderHookWithClient(() =>
			useReimbursementRequestDetail("user-1"),
		);
		await waitFor(() =>
			expect(
				rendered.queryClient.getQueryData(["reimbursement-requests", "user-1"]),
			).toBeDefined(),
		);
		return rendered;
	}

	it("opens the selected request from the live list and keeps it while closing", async () => {
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([ownRequest])),
		);
		const { result } = await renderDetailHook();

		expect(result.current.isDetailOpen).toBe(false);
		expect(result.current.selectedRequest).toBeNull();

		act(() => result.current.openDetail(ownRequest));
		expect(result.current.isDetailOpen).toBe(true);
		expect(result.current.selectedRequest?.id).toBe("req-1");

		act(() => result.current.setDetailOpen(false));
		expect(result.current.isDetailOpen).toBe(false);
		// Content stays available for the dialog's exit animation.
		expect(result.current.selectedRequest?.id).toBe("req-1");
	});

	it("stays closed when the selected request is no longer in the list", async () => {
		server.use(http.get("/api/reimbursements", () => HttpResponse.json([])));
		const { result } = await renderDetailHook();

		act(() => result.current.openDetail(ownRequest));

		expect(result.current.selectedRequest).toBeNull();
		expect(result.current.isDetailOpen).toBe(false);
	});

	it("opens and downloads the selected receipt", async () => {
		const requested: string[] = [];
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([ownRequest])),
			http.get("/api/reimbursements/req-1/receipt", ({ request }) => {
				requested.push(new URL(request.url).search);
				return HttpResponse.arrayBuffer(new ArrayBuffer(4));
			}),
		);
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		const { result } = await renderDetailHook();

		act(() => result.current.openDetail(ownRequest));
		await act(() => result.current.handleViewReceipt());
		await act(() => result.current.handleDownloadReceipt());

		expect(requested).toEqual(["", "?download=1"]);
		expect(windowOpen).toHaveBeenCalledWith(
			"blob:own",
			"_blank",
			"noopener,noreferrer",
		);
		expect(showToast).not.toHaveBeenCalled();
	});

	it("shows an error toast when the receipt cannot be loaded", async () => {
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([ownRequest])),
			http.get("/api/reimbursements/req-1/receipt", () =>
				HttpResponse.json({ error: "Receipt not found" }, { status: 404 }),
			),
		);
		const { result } = await renderDetailHook();

		act(() => result.current.openDetail(ownRequest));
		await act(() => result.current.handleDownloadReceipt());

		expect(showToast).toHaveBeenCalledWith(
			"Could not open receipt: Receipt not found",
			"error",
		);
	});

	it("ignores receipt actions when nothing is selected", async () => {
		server.use(
			http.get("/api/reimbursements", () => HttpResponse.json([ownRequest])),
		);
		const { result } = await renderDetailHook();

		await act(() => result.current.handleViewReceipt());

		expect(windowOpen).not.toHaveBeenCalled();
		expect(showToast).not.toHaveBeenCalled();
	});
});
