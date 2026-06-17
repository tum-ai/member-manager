import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateReimbursementRequestPayload } from "@/features/reimbursements/reimbursementTypes";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useReimbursementForm } from "./useReimbursementForm";

const { showToast, memberState, sepaState } = vi.hoisted(() => ({
	showToast: vi.fn(),
	memberState: {
		member: { user_id: "user-123", department: "Software Development" } as
			| { user_id: string; department: string }
			| undefined,
	},
	sepaState: {
		sepa: {
			user_id: "user-123",
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
		} as { user_id: string; iban: string; bic: string } | undefined,
	},
}));

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../hooks/useMemberData", () => ({
	useMemberData: () => memberState,
}));

vi.mock("../../../hooks/useSepaData", () => ({
	useSepaData: () => sepaState,
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

const pdfReceipt = new File(["%PDF-1.4"], "receipt.pdf", {
	type: "application/pdf",
});

function dropEvent(file: File): React.DragEvent<HTMLLabelElement> {
	return {
		preventDefault: () => {},
		dataTransfer: { files: [file] },
	} as unknown as React.DragEvent<HTMLLabelElement>;
}

function submitEvent(): React.FormEvent<HTMLFormElement> {
	return {
		preventDefault: () => {},
	} as React.FormEvent<HTMLFormElement>;
}

describe("useReimbursementForm", () => {
	beforeEach(() => {
		showToast.mockReset();
		memberState.member = {
			user_id: "user-123",
			department: "Software Development",
		};
		sepaState.sepa = {
			user_id: "user-123",
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
		};
		server.use(http.get("/api/reimbursements", () => HttpResponse.json([])));
	});

	it("prefills department and bank details from profile data", async () => {
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);

		await waitFor(() =>
			expect(result.current.values.department).toBe("Software Development"),
		);
		expect(result.current.values.paymentIban).toBe("DE89370400440532013000");
		expect(result.current.values.paymentBic).toBe("COBADEFFXXX");
	});

	it("clears prefilled bank details when switching to invoice and restores them", async () => {
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.paymentIban).toBe("DE89370400440532013000"),
		);

		act(() => result.current.handleSubmissionTypeChange("invoice"));
		expect(result.current.values.paymentIban).toBe("");
		expect(result.current.values.paymentBic).toBe("");

		act(() => result.current.handleSubmissionTypeChange("reimbursement"));
		expect(result.current.values.paymentIban).toBe("DE89370400440532013000");
		expect(result.current.values.paymentBic).toBe("COBADEFFXXX");
	});

	it("ignores empty submission-type changes", async () => {
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.department).toBe("Software Development"),
		);

		act(() => result.current.handleSubmissionTypeChange(""));
		expect(result.current.values.submissionType).toBe("reimbursement");
	});

	it("flags a department override warning", async () => {
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.department).toBe("Software Development"),
		);

		act(() => result.current.setField("department", "Community"));
		expect(result.current.showDepartmentWarning).toBe(true);
	});

	it("extracts receipt fields and toasts on a successful parse", async () => {
		server.use(
			http.post("/api/reimbursements/parse-receipt", () =>
				HttpResponse.json({
					amount: 42.5,
					date: "2026-04-12",
					description: "Workshop snacks",
					payment_iban: null,
					payment_bic: null,
				}),
			),
		);
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);

		await act(async () => {
			await result.current.handleReceiptDrop(dropEvent(pdfReceipt));
		});

		await waitFor(() => expect(result.current.values.amount).toBe("42.5"));
		expect(result.current.values.date).toBe("2026-04-12");
		expect(result.current.values.description).toBe("Workshop snacks");
		expect(result.current.values.receipt?.fileName).toBe("receipt.pdf");
		expect(showToast).toHaveBeenCalledWith(
			"Receipt details extracted. Please review and correct them.",
			"success",
		);
	});

	it("warns when receipt parsing fails but keeps the attachment", async () => {
		server.use(
			http.post("/api/reimbursements/parse-receipt", () =>
				HttpResponse.json({ message: "parse failed" }, { status: 500 }),
			),
		);
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);

		await act(async () => {
			await result.current.handleReceiptDrop(dropEvent(pdfReceipt));
		});

		await waitFor(() =>
			expect(result.current.values.receipt?.fileName).toBe("receipt.pdf"),
		);
		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("automatic extraction failed"),
			"warning",
		);
	});

	it("rejects disallowed receipt types", async () => {
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);

		const badFile = new File(["x"], "note.txt", { type: "text/plain" });
		await act(async () => {
			await result.current.handleReceiptDrop(dropEvent(badFile));
		});

		await waitFor(() =>
			expect(result.current.errors.receiptFile).toBe(
				"Upload a PDF, JPG, or PNG receipt.",
			),
		);
		expect(result.current.values.receipt).toBeNull();
	});

	it("blocks submit and surfaces errors when required fields are missing", async () => {
		let posted = false;
		server.use(
			http.post("/api/reimbursements", () => {
				posted = true;
				return HttpResponse.json({});
			}),
		);
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.department).toBe("Software Development"),
		);

		await act(async () => {
			await result.current.handleSubmit(submitEvent());
		});

		expect(result.current.errors.amount).toBe("Enter a positive amount.");
		expect(result.current.errors.receiptFile).toBe("Attach a receipt.");
		expect(posted).toBe(false);
	});

	it("submits a complete request and resets the form to profile defaults", async () => {
		let body: CreateReimbursementRequestPayload | null = null;
		server.use(
			http.post("/api/reimbursements/parse-receipt", () =>
				HttpResponse.json({
					amount: null,
					date: null,
					description: null,
					payment_iban: null,
					payment_bic: null,
				}),
			),
			http.post("/api/reimbursements", async ({ request }) => {
				body = (await request.json()) as CreateReimbursementRequestPayload;
				return HttpResponse.json({ id: "new" });
			}),
		);
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.paymentIban).toBe("DE89370400440532013000"),
		);

		await act(async () => {
			await result.current.handleReceiptDrop(dropEvent(pdfReceipt));
		});
		await waitFor(() =>
			expect(result.current.values.receipt?.fileName).toBe("receipt.pdf"),
		);

		act(() => result.current.setField("amount", "42.50"));
		act(() => result.current.setField("date", "2026-04-12"));
		act(() => result.current.setField("description", "  Snacks  "));

		await act(async () => {
			await result.current.handleSubmit(submitEvent());
		});

		await waitFor(() => expect(body).not.toBeNull());
		const sent = body as CreateReimbursementRequestPayload | null;
		expect(sent?.amount).toBe(42.5);
		expect(sent?.description).toBe("Snacks");
		expect(sent?.submission_type).toBe("reimbursement");
		expect(sent?.receipt_filename).toBe("receipt.pdf");
		expect(showToast).toHaveBeenCalledWith(
			"Reimbursement request submitted.",
			"success",
		);
		expect(result.current.values.receipt).toBeNull();
		expect(result.current.values.amount).toBe("");
		expect(result.current.values.department).toBe("Software Development");
	});

	it("toasts an error when submission fails", async () => {
		server.use(
			http.post("/api/reimbursements/parse-receipt", () =>
				HttpResponse.json({
					amount: null,
					date: null,
					description: null,
					payment_iban: null,
					payment_bic: null,
				}),
			),
			http.post("/api/reimbursements", () =>
				HttpResponse.json({ message: "nope" }, { status: 500 }),
			),
		);
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.paymentIban).toBe("DE89370400440532013000"),
		);

		await act(async () => {
			await result.current.handleReceiptDrop(dropEvent(pdfReceipt));
		});
		await waitFor(() =>
			expect(result.current.values.receipt?.fileName).toBe("receipt.pdf"),
		);
		act(() => result.current.setField("amount", "10"));
		act(() => result.current.setField("date", "2026-04-12"));
		act(() => result.current.setField("description", "Snacks"));

		await act(async () => {
			await result.current.handleSubmit(submitEvent());
		});

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				expect.stringContaining("Error submitting reimbursement request"),
				"error",
			),
		);
	});

	it("does not process a dropped receipt while busy", async () => {
		let parseHits = 0;
		server.use(
			http.post("/api/reimbursements/parse-receipt", () => {
				parseHits += 1;
				return HttpResponse.json({
					amount: null,
					date: null,
					description: null,
					payment_iban: null,
					payment_bic: null,
				});
			}),
		);
		const { result } = renderHookWithClient(() =>
			useReimbursementForm("user-123"),
		);
		await waitFor(() =>
			expect(result.current.values.department).toBe("Software Development"),
		);

		await act(async () => {
			await result.current.handleReceiptDrop(dropEvent(pdfReceipt));
		});

		await waitFor(() => expect(parseHits).toBe(1));
		expect(result.current.isReceiptBusy).toBe(false);
	});
});
