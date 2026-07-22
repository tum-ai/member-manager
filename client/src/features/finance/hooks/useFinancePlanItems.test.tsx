import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinancePlanItems } from "./useFinancePlanItems";

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

function planResponse() {
	return {
		period_type: "year",
		period_key: String(new Date().getFullYear()),
		items: [
			{
				id: "plan-1",
				department: "Makeathon",
				period_type: "year",
				period_key: String(new Date().getFullYear()),
				label: "Venue",
				category: null,
				planned_amount: 3000,
				expected_month: null,
				status: "planned",
				note: null,
			},
		],
		totals: { planned: 3000, budget: 10000, actual: 1200 },
		source: "mock",
		generated_at: "2026-07-18T12:00:00.000Z",
	};
}

describe("useFinancePlanItems", () => {
	it("loads plan items and totals for the default period", async () => {
		server.use(
			http.get("/api/finance/plan-items", () =>
				HttpResponse.json(planResponse()),
			),
		);

		const { result } = renderHookWithClient(() => useFinancePlanItems());

		await waitFor(() => expect(result.current.items.length).toBe(1));
		expect(result.current.totals?.planned).toBe(3000);
	});

	it("creates a plan item via POST and toasts", async () => {
		showToast.mockClear();
		let postBody: Record<string, unknown> | null = null;
		server.use(
			http.get("/api/finance/plan-items", () =>
				HttpResponse.json(planResponse()),
			),
			http.post("/api/finance/plan-items", async ({ request }) => {
				postBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({ id: "plan-2" }, { status: 201 });
			}),
		);

		const { result } = renderHookWithClient(() => useFinancePlanItems());
		await waitFor(() => expect(result.current.items.length).toBe(1));

		act(() =>
			result.current.createItem({
				department: "Makeathon",
				label: "Catering",
				category: "Food",
				direction: "income",
				plannedAmount: 900,
				expectedMonth: "2026-05",
				status: "planned",
			}),
		);

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Planposten hinzugefügt.",
				"success",
			),
		);
		expect(postBody).toMatchObject({
			department: "Makeathon",
			label: "Catering",
			direction: "income",
			planned_amount: 900,
			expected_month: "2026-05",
		});
	});

	it("deletes a plan item and toasts", async () => {
		showToast.mockClear();
		let deletedId = "";
		server.use(
			http.get("/api/finance/plan-items", () =>
				HttpResponse.json(planResponse()),
			),
			http.delete("/api/finance/plan-items/:id", ({ params }) => {
				deletedId = String(params.id);
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() => useFinancePlanItems());
		await waitFor(() => expect(result.current.items.length).toBe(1));

		act(() => result.current.deleteItem("plan-1"));

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith("Planposten gelöscht.", "success"),
		);
		expect(deletedId).toBe("plan-1");
	});
});
