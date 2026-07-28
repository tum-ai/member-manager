import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceBudgets } from "./useFinanceBudgets";

const showToast = vi.fn();

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

function budgetsResponse(periodKey: string) {
	return {
		period_type: "year",
		period_key: periodKey,
		rows: [
			{
				department: "Makeathon",
				amount_planned: 5000,
				actual_expenses: 12000,
				remaining: -7000,
				pct_used: 240,
				over_budget: true,
				currency: "EUR",
				note: null,
			},
		],
		totals: { amount_planned: 5000, actual_expenses: 12000, remaining: -7000 },
		source: "mock",
		generated_at: "2026-07-18T12:00:00.000Z",
	};
}

describe("useFinanceBudgets", () => {
	it("loads budget-vs-actual rows for the default period", async () => {
		server.use(
			http.get("/api/finance/budgets", ({ request }) => {
				const key = new URL(request.url).searchParams.get("period_key") ?? "";
				return HttpResponse.json(budgetsResponse(key));
			}),
		);

		const { result } = renderHookWithClient(() => useFinanceBudgets());

		await waitFor(() => expect(result.current.rows.length).toBe(1));
		expect(result.current.period.type).toBe("year");
		expect(result.current.rows[0].over_budget).toBe(true);
	});

	it("saves a budget via PUT with the active period and toasts", async () => {
		showToast.mockClear();
		let putBody: Record<string, unknown> | null = null;
		server.use(
			http.get("/api/finance/budgets", ({ request }) => {
				const key = new URL(request.url).searchParams.get("period_key") ?? "";
				return HttpResponse.json(budgetsResponse(key));
			}),
			http.put("/api/finance/budgets", async ({ request }) => {
				putBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({
					department: "Makeathon",
					period_type: "year",
					period_key: putBody.period_key,
					amount_planned: 8000,
					currency: "EUR",
					note: null,
				});
			}),
		);

		const { result } = renderHookWithClient(() => useFinanceBudgets());
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		act(() =>
			result.current.saveBudget({
				department: "Makeathon",
				amountPlanned: 8000,
			}),
		);

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith("Budget saved.", "success"),
		);
		expect(putBody).toMatchObject({
			department: "Makeathon",
			period_type: "year",
			amount_planned: 8000,
		});
	});

	it("switches to a valid semester key when the period type changes", async () => {
		server.use(
			http.get("/api/finance/budgets", ({ request }) => {
				const key = new URL(request.url).searchParams.get("period_key") ?? "";
				return HttpResponse.json(budgetsResponse(key));
			}),
		);

		const { result } = renderHookWithClient(() => useFinanceBudgets());
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		act(() => result.current.setPeriodType("semester"));

		await waitFor(() => expect(result.current.period.type).toBe("semester"));
		expect(result.current.period.key).toMatch(/^(WS|SS)\d{2}$/);
	});
});
