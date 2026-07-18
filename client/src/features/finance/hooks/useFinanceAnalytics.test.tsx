import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceAnalytics } from "./useFinanceAnalytics";

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

function analyticsResponse() {
	return {
		by_department: [
			{
				department: "Makeathon",
				bereich: "wirtschaftlich",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
				unmapped: false,
			},
		],
		by_category: [
			{
				category: "Ohne Kategorie",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
				unmapped: true,
			},
		],
		by_month: [{ month: "2026-02", income: 0, expenses: 8700, net: -8700 }],
		by_bereich: [
			{
				bereich: "wirtschaftlich",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
			},
		],
		totals: {
			income: 0,
			expenses: 8700,
			net: -8700,
			count: 2,
			unmapped_count: 0,
		},
		source: "mock",
		generated_at: "2026-07-18T12:00:00.000Z",
	};
}

describe("useFinanceAnalytics", () => {
	it("loads analytics for the default date range", async () => {
		let requestedUrl = "";
		server.use(
			http.get("/api/finance/analytics", ({ request }) => {
				requestedUrl = request.url;
				return HttpResponse.json(analyticsResponse());
			}),
		);

		const { result } = renderHookWithClient(() => useFinanceAnalytics());

		await waitFor(() => expect(result.current.analytics).toBeDefined());
		expect(result.current.analytics?.by_department[0].department).toBe(
			"Makeathon",
		);
		expect(requestedUrl).toContain("date_from=");
		expect(requestedUrl).toContain("date_to=");
	});

	it("refetches when the date range changes", async () => {
		const seenFrom: string[] = [];
		server.use(
			http.get("/api/finance/analytics", ({ request }) => {
				seenFrom.push(new URL(request.url).searchParams.get("date_from") ?? "");
				return HttpResponse.json(analyticsResponse());
			}),
		);

		const { result } = renderHookWithClient(() => useFinanceAnalytics());
		await waitFor(() => expect(result.current.analytics).toBeDefined());

		act(() => result.current.updateDateFrom("2025-06-01"));

		await waitFor(() => expect(seenFrom).toContain("2025-06-01"));
	});
});
