import { describe, expect, it } from "vitest";
import {
	defaultValues,
	type FormValues,
	formatAmount,
	formatDate,
	getErrorMessage,
	getRequestTypeLabel,
	getStatusLabel,
	readFileAsBase64,
	sortRequestsByDateDesc,
	validateForm,
} from "./reimbursementSubmitUtils";
import type { ReimbursementRequest } from "./reimbursementTypes";

function makeRequest(
	overrides: Partial<ReimbursementRequest> = {},
): ReimbursementRequest {
	return {
		id: "req-1",
		user_id: "user-1",
		amount: 10,
		date: "2026-04-12",
		description: "Test",
		department: "Community",
		submission_type: "reimbursement",
		status: "requested",
		approval_status: "pending",
		payment_status: "to_be_paid",
		...overrides,
	};
}

describe("getErrorMessage", () => {
	it("returns the Error message", () => {
		expect(getErrorMessage(new Error("boom"))).toBe("boom");
	});

	it("falls back to Unknown error for non-Error values", () => {
		expect(getErrorMessage("nope")).toBe("Unknown error");
		expect(getErrorMessage(undefined)).toBe("Unknown error");
	});
});

describe("formatDate", () => {
	it("formats an ISO date in en-GB short format", () => {
		expect(formatDate("2026-04-12")).toBe("12 Apr 2026");
	});

	it("returns No date for an empty value", () => {
		expect(formatDate("")).toBe("No date");
	});
});

describe("formatAmount", () => {
	it("formats a number as EUR currency", () => {
		expect(formatAmount(42.5).replace(/ /g, " ")).toBe("42,50 €");
	});
});

describe("getStatusLabel", () => {
	it("prioritises not_approved", () => {
		expect(
			getStatusLabel(makeRequest({ approval_status: "not_approved" })),
		).toBe("Not approved");
	});

	it("returns Paid when status or payment_status is paid", () => {
		expect(getStatusLabel(makeRequest({ status: "paid" }))).toBe("Paid");
		expect(getStatusLabel(makeRequest({ payment_status: "paid" }))).toBe(
			"Paid",
		);
	});

	it("returns Approved for approved approval_status", () => {
		expect(getStatusLabel(makeRequest({ approval_status: "approved" }))).toBe(
			"Approved",
		);
	});

	it("defaults to Pending", () => {
		expect(getStatusLabel(makeRequest())).toBe("Pending");
	});
});

describe("getRequestTypeLabel", () => {
	it("labels invoices and reimbursements", () => {
		expect(
			getRequestTypeLabel(makeRequest({ submission_type: "invoice" })),
		).toBe("Invoice");
		expect(
			getRequestTypeLabel(makeRequest({ submission_type: "reimbursement" })),
		).toBe("Reimbursement");
	});
});

describe("sortRequestsByDateDesc", () => {
	it("sorts newest created_at first and is non-mutating", () => {
		const older = makeRequest({
			id: "older",
			created_at: "2026-04-14T10:00:00Z",
		});
		const newer = makeRequest({
			id: "newer",
			created_at: "2026-04-20T10:00:00Z",
		});
		const input = [older, newer];
		const sorted = sortRequestsByDateDesc(input);

		expect(sorted.map((request) => request.id)).toEqual(["newer", "older"]);
		expect(input.map((request) => request.id)).toEqual(["older", "newer"]);
	});

	it("falls back to date and treats invalid dates as 0", () => {
		const noCreated = makeRequest({
			id: "no-created",
			created_at: undefined,
			date: "2026-05-01",
		});
		const invalid = makeRequest({
			id: "invalid",
			created_at: undefined,
			date: "not-a-date",
		});
		const sorted = sortRequestsByDateDesc([invalid, noCreated]);

		expect(sorted.map((request) => request.id)).toEqual([
			"no-created",
			"invalid",
		]);
	});
});

describe("readFileAsBase64", () => {
	it("strips the data-url prefix", async () => {
		const file = new File(["hello"], "hello.txt", { type: "text/plain" });
		const base64 = await readFileAsBase64(file);

		expect(base64).toBe(btoa("hello"));
	});
});

describe("validateForm", () => {
	function values(overrides: Partial<FormValues> = {}): FormValues {
		return {
			...defaultValues,
			amount: "10",
			date: "2026-04-12",
			description: "Snacks",
			department: "Community",
			paymentIban: "DE89370400440532013000",
			paymentBic: "COBADEFFXXX",
			receipt: {
				fileName: "r.pdf",
				mimeType: "application/pdf",
				sizeBytes: 123,
				storageBucket: "reimbursement-receipts",
				storagePath: "user-123/r.pdf",
			},
			...overrides,
		};
	}

	it("returns no errors for a complete form", () => {
		expect(validateForm(values())).toEqual({});
	});

	it("flags every missing field", () => {
		const errors = validateForm(
			values({
				amount: "0",
				date: "",
				description: "   ",
				department: "",
				paymentIban: " ",
				paymentBic: "",
				receipt: null,
			}),
		);

		expect(errors).toEqual({
			amount: "Enter a positive amount.",
			date: "Select the expense date.",
			description: "Describe what this request is for.",
			department: "Select a department.",
			receiptFile: "Attach a receipt.",
			paymentIban: "IBAN is required.",
			paymentBic: "BIC is required.",
		});
	});

	it("rejects non-numeric amounts", () => {
		expect(validateForm(values({ amount: "abc" })).amount).toBe(
			"Enter a positive amount.",
		);
	});
});
