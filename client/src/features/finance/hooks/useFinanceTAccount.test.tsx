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
		plan_item_labels: {},
		source: "mock",
		generated_at: "2026-08-04T10:00:00.000Z",
	};
}

// The hook also loads the department's projects, which back the "add to
// project" picker (FR-L2). They are requested together with the T-account, so
// every test needs the handler.
function projectsHandler() {
	return http.get("/api/finance/projects", () =>
		HttpResponse.json({
			projects: [
				{
					id: "11111111-1111-4111-8111-111111111111",
					parent_project_id: null,
					name: "Hackathon",
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					tax_area: null,
					target_amount: 0,
					status: "active",
					description: null,
					sub_team: null,
					created_at: "2026-08-04T10:00:00.000Z",
					updated_at: "2026-08-04T10:00:00.000Z",
				},
			],
		}),
	);
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
			projectsHandler(),
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
		// The project picker is fed from the same period and department.
		await waitFor(() => expect(result.current.projects.length).toBe(1));
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
			projectsHandler(),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceTAccount({ canManage: false, department: "Community" }),
		);

		await waitFor(() => expect(result.current.groups.length).toBe(1));
		expect(requestedDepartment).toBe("Community");
		expect(result.current.canChooseDepartment).toBe(false);
	});
});
