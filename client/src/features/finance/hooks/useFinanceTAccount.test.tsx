import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceTAccount } from "./useFinanceTAccount";

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

function tAccountResponse(department: string) {
	return {
		period_type: "year",
		period_key: "2026",
		department,
		groups: [
			{
				project_id: null,
				project_name: null,
				parent_project_id: null,
				target_amount: null,
				expense_lines: [
					{
						kind: "actual",
						direction: "expense",
						label: "Catering",
						category: "1",
						project_id: null,
						amount: 119,
						vat_amount: 19,
						status: null,
						posting_external_id: "BB-1",
						plan_item_id: null,
					},
				],
				income_lines: [],
				actual: { income: 0, expenses: 119, saldo: -119 },
				plan: { income: 0, expenses: 119, saldo: -119 },
			},
		],
		totals: {
			actual: { income: 0, expenses: 119, saldo: -119 },
			plan: { income: 0, expenses: 119, saldo: -119 },
			vat_income: 0,
			vat_expenses: 19,
		},
		source: "mock",
		generated_at: "2026-08-04T10:00:00.000Z",
	};
}

describe("useFinanceTAccount", () => {
	it("does not fetch until a reviewer selects a department", async () => {
		let requestedDepartment: string | null = null;
		server.use(
			http.get("/api/finance/t-account", ({ request }) => {
				requestedDepartment = new URL(request.url).searchParams.get(
					"department",
				);
				return HttpResponse.json(tAccountResponse(requestedDepartment ?? "?"));
			}),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceTAccount({ canManage: true, department: null }),
		);

		expect(result.current.department).toBeNull();
		expect(result.current.groups).toEqual([]);
		expect(requestedDepartment).toBeNull();

		act(() => result.current.setDepartment("Makeathon"));

		await waitFor(() => expect(result.current.groups.length).toBe(1));
		expect(requestedDepartment).toBe("Makeathon");
		expect(result.current.totals?.vat_expenses).toBe(19);
	});

	it("pins a scoped member to their own department", async () => {
		let requestedDepartment: string | null = null;
		server.use(
			http.get("/api/finance/t-account", ({ request }) => {
				requestedDepartment = new URL(request.url).searchParams.get(
					"department",
				);
				return HttpResponse.json(tAccountResponse(requestedDepartment ?? "?"));
			}),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceTAccount({ canManage: false, department: "Community" }),
		);

		await waitFor(() => expect(result.current.groups.length).toBe(1));
		expect(requestedDepartment).toBe("Community");
		expect(result.current.canChooseDepartment).toBe(false);
	});
});
