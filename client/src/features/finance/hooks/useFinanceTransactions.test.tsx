import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceTransactions } from "./useFinanceTransactions";

const showToast = vi.fn();
const xlsxMock = vi.hoisted(() => ({
	writeFile: vi.fn(),
	jsonToSheet: vi.fn(() => ({ sheet: true })),
	bookNew: vi.fn(() => ({ book: true })),
	bookAppendSheet: vi.fn(),
}));

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

vi.mock("xlsx", () => ({
	utils: {
		json_to_sheet: xlsxMock.jsonToSheet,
		book_new: xlsxMock.bookNew,
		book_append_sheet: xlsxMock.bookAppendSheet,
	},
	writeFile: xlsxMock.writeFile,
}));

describe("useFinanceTransactions", () => {
	beforeEach(() => {
		showToast.mockClear();
		xlsxMock.writeFile.mockClear();
		xlsxMock.jsonToSheet.mockClear();
		xlsxMock.bookNew.mockClear();
		xlsxMock.bookAppendSheet.mockClear();
	});

	it("fetches BuchhaltungsButler transactions for the selected date range", async () => {
		let requestedUrl = "";
		server.use(
			http.get(
				"/api/finance/buchhaltungsbutler/transactions",
				({ request }) => {
					requestedUrl = request.url;
					return HttpResponse.json({
						source: "mock",
						generated_at: "2026-07-08T12:00:00.000Z",
						transactions: [
							{
								external_id: "BB-1",
								date: "2026-02-14",
								postingtext: "Sponsoring JetBrains",
								amount: 7500,
								currency: "EUR",
								vat: 0,
								credit_type: "credit",
								debit_postingaccount_number: "8450",
								credit_postingaccount_number: "1200",
								cost_location: "120",
								cost_location_two: "0",
								transaction_amount: 7500,
								transaction_purpose: "JetBrains partnership tranche 1",
							},
						],
					});
				},
			),
		);

		const { result } = renderHookWithClient(() => useFinanceTransactions());

		await waitFor(() => expect(result.current.transactions).toHaveLength(1));
		expect(requestedUrl).toContain("date_from=");
		expect(requestedUrl).toContain("date_to=");
		expect(result.current.source).toBe("mock");
		expect(result.current.summary.income).toBe(7500);
	});

	it("filters loaded transactions and exports visible rows", async () => {
		server.use(
			http.get("/api/finance/buchhaltungsbutler/transactions", () =>
				HttpResponse.json({
					source: "mock",
					generated_at: "2026-07-08T12:00:00.000Z",
					transactions: [
						{
							external_id: "BB-1",
							date: "2026-02-14",
							postingtext: "Sponsoring JetBrains",
							amount: 7500,
							currency: "EUR",
							vat: 0,
							credit_type: "credit",
							debit_postingaccount_number: "8450",
							credit_postingaccount_number: "1200",
							cost_location: "120",
							cost_location_two: "0",
							transaction_amount: 7500,
							transaction_purpose: "JetBrains partnership tranche 1",
						},
						{
							external_id: "BB-2",
							date: "2026-02-01",
							postingtext: "Slack subscription",
							amount: -266,
							currency: "EUR",
							vat: 19,
							credit_type: "debit",
							debit_postingaccount_number: "6840",
							credit_postingaccount_number: "1200",
							cost_location: "130",
							cost_location_two: "5",
							transaction_amount: -266,
							transaction_purpose: "Slack monthly plan",
						},
					],
				}),
			),
		);

		const { result } = renderHookWithClient(() => useFinanceTransactions());
		await waitFor(() => expect(result.current.transactions).toHaveLength(2));

		act(() => result.current.updateDirection("expenses"));
		expect(result.current.filteredTransactions).toHaveLength(1);
		expect(result.current.filteredTransactions[0].postingtext).toBe(
			"Slack subscription",
		);

		act(() => result.current.exportTransactions());
		expect(xlsxMock.writeFile).toHaveBeenCalledWith(
			expect.anything(),
			"buchhaltungsbutler_transactions.xlsx",
		);
		expect(showToast).toHaveBeenCalledWith(
			"Finance transactions exported.",
			"success",
		);
	});

	it("warns before exporting an empty transaction set", async () => {
		server.use(
			http.get("/api/finance/buchhaltungsbutler/transactions", () =>
				HttpResponse.json({
					source: "mock",
					generated_at: "2026-07-08T12:00:00.000Z",
					transactions: [],
				}),
			),
		);

		const { result } = renderHookWithClient(() => useFinanceTransactions());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.exportTransactions());

		expect(xlsxMock.writeFile).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"No finance transactions to export.",
			"warning",
		);
	});
});
