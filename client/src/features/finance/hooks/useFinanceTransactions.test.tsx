import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceTransactions } from "./useFinanceTransactions";

const showToast = vi.fn();
const { writeXlsxFileMock, toFileMock } = vi.hoisted(() => {
	const toFileMock = vi.fn(() => Promise.resolve());
	const writeXlsxFileMock = vi.fn(() => ({
		toFile: toFileMock,
		toBlob: vi.fn(),
	}));
	return { writeXlsxFileMock, toFileMock };
});

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

vi.mock("write-excel-file/browser", () => ({
	default: writeXlsxFileMock,
}));

describe("useFinanceTransactions", () => {
	beforeEach(() => {
		showToast.mockClear();
		writeXlsxFileMock.mockClear();
		toFileMock.mockClear();
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

		await act(async () => {
			await result.current.exportTransactions();
		});
		expect(writeXlsxFileMock).toHaveBeenCalledOnce();
		expect(toFileMock).toHaveBeenCalledWith(
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

		await act(async () => {
			await result.current.exportTransactions();
		});

		expect(writeXlsxFileMock).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"No finance transactions to export.",
			"warning",
		);
	});

	it("reports Excel generation failures", async () => {
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
					],
				}),
			),
		);
		toFileMock.mockRejectedValueOnce(new Error("write failed"));
		const { result } = renderHookWithClient(() => useFinanceTransactions());
		await waitFor(() => expect(result.current.transactions).toHaveLength(1));

		await act(async () => {
			await result.current.exportTransactions();
		});

		expect(showToast).toHaveBeenCalledWith(
			"Could not generate the finance export.",
			"error",
		);
	});
});
