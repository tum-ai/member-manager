import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ReimbursementRequest,
	ResubmitReimbursementRequestPayload,
} from "@/features/reimbursements/reimbursementTypes";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useReimbursementForm } from "./useReimbursementForm";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../hooks/useMemberData", () => ({
	useMemberData: () => ({
		member: {
			user_id: "user-123",
			department: "Software Development",
			active: true,
			member_status: "active",
			member_role: "Member",
		},
		isLoading: false,
	}),
}));

vi.mock("../../../hooks/useSepaData", () => ({
	useSepaData: () => ({
		sepa: {
			user_id: "user-123",
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
		},
		isLoading: false,
	}),
}));

vi.mock("../../../hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));

vi.mock("../../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
		storage: {
			from: vi.fn(() => ({
				uploadToSignedUrl: vi.fn().mockResolvedValue({ data: {}, error: null }),
			})),
		},
	},
}));

// A rejected invoice paid to a vendor account, not the member's profile IBAN.
const VENDOR_IBAN = "DE12500105170648489890";
const rejectedInvoice: ReimbursementRequest = {
	id: "req-rejected",
	user_id: "user-123",
	amount: 128.9,
	date: "2026-06-03",
	description: "Prototype materials",
	department: "Makeathon",
	submission_type: "invoice",
	payment_iban: VENDOR_IBAN,
	payment_bic: "INGDDEFFXXX",
	receipt_filename: "invoice.pdf",
	receipt_mime_type: "application/pdf",
	status: "rejected",
	approval_status: "not_approved",
	payment_status: "to_be_paid",
	rejection_reason: "Upload the itemised invoice",
};

function submitEvent(): React.FormEvent<HTMLFormElement> {
	return { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
}

function dropEvent(file: File): React.DragEvent<HTMLLabelElement> {
	return {
		preventDefault: () => {},
		dataTransfer: { files: [file] },
	} as unknown as React.DragEvent<HTMLLabelElement>;
}

describe("useReimbursementForm resubmission", () => {
	beforeEach(() => {
		showToast.mockReset();
		server.use(
			http.get("/api/reimbursements", () =>
				HttpResponse.json([rejectedInvoice]),
			),
		);
	});

	async function renderReady() {
		const view = renderHookWithClient(() => useReimbursementForm("user-123"));
		await waitFor(() =>
			expect(view.result.current.values.paymentIban).toBe(
				"DE89370400440532013000",
			),
		);
		return view;
	}

	it("prefills the form with the rejected request and keeps its receipt", async () => {
		const { result } = await renderReady();

		act(() => result.current.startEditing(rejectedInvoice));

		expect(result.current.editingRequest?.id).toBe("req-rejected");
		expect(result.current.values).toMatchObject({
			submissionType: "invoice",
			amount: "128.9",
			date: "2026-06-03",
			description: "Prototype materials",
			department: "Makeathon",
			paymentIban: VENDOR_IBAN,
			paymentBic: "INGDDEFFXXX",
			receipt: { fileName: "invoice.pdf", existing: true },
		});
	});

	it("restores the request's own account after a round trip through reimbursement", async () => {
		const { result } = await renderReady();
		act(() => result.current.startEditing(rejectedInvoice));

		act(() => result.current.handleSubmissionTypeChange("reimbursement"));
		expect(result.current.values.paymentIban).toBe("DE89370400440532013000");
		act(() => result.current.handleSubmissionTypeChange("invoice"));

		expect(result.current.values.paymentIban).toBe(VENDOR_IBAN);
	});

	it("does not edit a request that isn't rejected", async () => {
		const { result } = await renderReady();

		act(() =>
			result.current.startEditing({
				...rejectedInvoice,
				status: "requested",
				approval_status: "pending",
			}),
		);

		expect(result.current.editingRequest).toBeNull();
	});

	it("resubmits the corrections without the kept receipt, then resets", async () => {
		let resubmitted: ResubmitReimbursementRequestPayload | undefined;
		server.use(
			http.post(
				"/api/reimbursements/:id/resubmit",
				async ({ params, request }) => {
					expect(params.id).toBe("req-rejected");
					resubmitted =
						(await request.json()) as ResubmitReimbursementRequestPayload;
					return HttpResponse.json({
						...rejectedInvoice,
						approval_status: "pending",
					});
				},
			),
		);
		const { result } = await renderReady();
		act(() => result.current.startEditing(rejectedInvoice));
		act(() => result.current.setField("amount", "131.5"));

		await act(() => result.current.handleSubmit(submitEvent()));

		expect(resubmitted).toEqual({
			amount: 131.5,
			date: "2026-06-03",
			description: "Prototype materials",
			department: "Makeathon",
			submission_type: "invoice",
			payment_iban: VENDOR_IBAN,
			payment_bic: "INGDDEFFXXX",
		});
		expect(showToast).toHaveBeenCalledWith(
			"Request resubmitted for review.",
			"success",
		);
		expect(result.current.editingRequest).toBeNull();
		expect(result.current.values.amount).toBe("");
		expect(result.current.values.department).toBe("Software Development");
	});

	it("sends a replacement receipt", async () => {
		let resubmitted: ResubmitReimbursementRequestPayload | undefined;
		server.use(
			http.post("/api/reimbursements/receipt-upload-url", () =>
				HttpResponse.json({
					bucket: "reimbursement-receipts",
					path: "user-123/itemised.pdf",
					token: "upload-token",
					signed_url: "https://storage.example/upload",
				}),
			),
			http.post("/api/reimbursements/parse-receipt", () =>
				HttpResponse.json({
					amount: null,
					date: null,
					description: null,
					payment_iban: null,
					payment_bic: null,
				}),
			),
			http.post("/api/reimbursements/:id/resubmit", async ({ request }) => {
				resubmitted =
					(await request.json()) as ResubmitReimbursementRequestPayload;
				return HttpResponse.json(rejectedInvoice);
			}),
		);
		const { result } = await renderReady();
		act(() => result.current.startEditing(rejectedInvoice));

		await act(() =>
			result.current.handleReceiptDrop(
				dropEvent(
					new File(["%PDF-1.4"], "itemised.pdf", { type: "application/pdf" }),
				),
			),
		);
		await waitFor(() =>
			expect(result.current.values.receipt?.fileName).toBe("itemised.pdf"),
		);
		await waitFor(() => expect(result.current.isReceiptBusy).toBe(false));
		await act(() => result.current.handleSubmit(submitEvent()));

		expect(resubmitted).toMatchObject({
			receipt_filename: "itemised.pdf",
			receipt_storage_bucket: "reimbursement-receipts",
			receipt_storage_path: "user-123/itemised.pdf",
		});
	});

	it("keeps the edit open when the server refuses the resubmission", async () => {
		server.use(
			http.post("/api/reimbursements/:id/resubmit", () =>
				HttpResponse.json(
					{ error: "Only rejected requests can be resubmitted" },
					{ status: 409 },
				),
			),
		);
		const { result } = await renderReady();
		act(() => result.current.startEditing(rejectedInvoice));

		await act(() => result.current.handleSubmit(submitEvent()));

		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("Only rejected requests can be resubmitted"),
			"error",
		);
		expect(result.current.editingRequest?.id).toBe("req-rejected");
	});

	it("keeps the new receipt after a failed resubmit so the retry sends it", async () => {
		const attempts: ResubmitReimbursementRequestPayload[] = [];
		server.use(
			http.post("/api/reimbursements/receipt-upload-url", () =>
				HttpResponse.json({
					bucket: "reimbursement-receipts",
					path: "user-123/itemised.pdf",
					token: "upload-token",
					signed_url: "https://storage.example/upload",
				}),
			),
			http.post("/api/reimbursements/parse-receipt", () =>
				HttpResponse.json({
					amount: null,
					date: null,
					description: null,
					payment_iban: null,
					payment_bic: null,
				}),
			),
			http.post("/api/reimbursements/:id/resubmit", async ({ request }) => {
				attempts.push(
					(await request.json()) as ResubmitReimbursementRequestPayload,
				);
				return attempts.length === 1
					? HttpResponse.json(
							{ error: "Failed to resubmit reimbursement request" },
							{ status: 500 },
						)
					: HttpResponse.json(rejectedInvoice);
			}),
		);
		const { result } = await renderReady();
		act(() => result.current.startEditing(rejectedInvoice));
		await act(() =>
			result.current.handleReceiptDrop(
				dropEvent(
					new File(["%PDF-1.4"], "itemised.pdf", { type: "application/pdf" }),
				),
			),
		);
		await waitFor(() => expect(result.current.isReceiptBusy).toBe(false));
		expect(result.current.values.receipt?.fileName).toBe("itemised.pdf");

		await act(() => result.current.handleSubmit(submitEvent()));

		// The server keeps the upload on failure, so the form keeps it too.
		expect(result.current.values.receipt?.fileName).toBe("itemised.pdf");
		expect(result.current.editingRequest?.id).toBe("req-rejected");

		await act(() => result.current.handleSubmit(submitEvent()));

		expect(attempts).toHaveLength(2);
		expect(attempts[1]).toMatchObject({
			receipt_filename: "itemised.pdf",
			receipt_storage_path: "user-123/itemised.pdf",
		});
		expect(result.current.editingRequest).toBeNull();
	});

	it("drops a receipt parse that finishes after the member switched to editing", async () => {
		let finishParse: () => void = () => {};
		const parseGate = new Promise<void>((resolve) => {
			finishParse = resolve;
		});
		server.use(
			http.post("/api/reimbursements/receipt-upload-url", () =>
				HttpResponse.json({
					bucket: "reimbursement-receipts",
					path: "user-123/other.pdf",
					token: "upload-token",
					signed_url: "https://storage.example/upload",
				}),
			),
			http.post("/api/reimbursements/parse-receipt", async () => {
				await parseGate;
				return HttpResponse.json({
					amount: 999,
					date: "2026-01-01",
					description: "Another receipt",
					payment_iban: "DE89370400440532013000",
					payment_bic: "COBADEFFXXX",
				});
			}),
		);
		const { result } = await renderReady();

		// A receipt for a new request is still being parsed...
		act(() => {
			void result.current.handleReceiptDrop(
				dropEvent(
					new File(["%PDF-1.4"], "other.pdf", { type: "application/pdf" }),
				),
			);
		});
		await waitFor(() =>
			expect(result.current.values.receipt?.fileName).toBe("other.pdf"),
		);
		// ...when the member opens a rejected invoice to fix it.
		act(() => result.current.startEditing(rejectedInvoice));
		finishParse();
		await waitFor(() => expect(result.current.isReceiptBusy).toBe(false));

		expect(result.current.values).toMatchObject({
			amount: "128.9",
			description: "Prototype materials",
			paymentIban: VENDOR_IBAN,
			receipt: { fileName: "invoice.pdf", existing: true },
		});
		expect(showToast).not.toHaveBeenCalledWith(
			expect.stringContaining("Receipt details extracted"),
			"success",
		);
	});

	it("cancelling returns to a blank new request", async () => {
		const { result } = await renderReady();
		act(() => result.current.startEditing(rejectedInvoice));

		act(() => result.current.cancelEditing());

		expect(result.current.editingRequest).toBeNull();
		expect(result.current.values.submissionType).toBe("reimbursement");
		expect(result.current.values.receipt).toBeNull();
		expect(result.current.values.paymentIban).toBe("DE89370400440532013000");
	});
});
