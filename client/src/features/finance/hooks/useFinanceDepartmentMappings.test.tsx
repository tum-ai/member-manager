import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceDepartmentMappings } from "./useFinanceDepartmentMappings";

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

function mappingsResponse() {
	return {
		rows: [
			{
				cost_location: "82",
				department: null,
				bereich: null,
				note: null,
				posting_count: 3,
				net: 120,
				sample_texts: ["Fee A"],
			},
		],
		generated_at: "2026-07-18T12:00:00.000Z",
	};
}

describe("useFinanceDepartmentMappings", () => {
	it("loads mapping rows and surfaces unassigned ones", async () => {
		server.use(
			http.get("/api/finance/department-mappings", () =>
				HttpResponse.json(mappingsResponse()),
			),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceDepartmentMappings(),
		);

		await waitFor(() => expect(result.current.rows.length).toBe(1));
		expect(result.current.rows[0].department).toBeNull();
	});

	it("saves a mapping via PUT and toasts on success", async () => {
		showToast.mockClear();
		let putBody: unknown = null;
		let putCostLocation = "";
		server.use(
			http.get("/api/finance/department-mappings", () =>
				HttpResponse.json(mappingsResponse()),
			),
			http.put(
				"/api/finance/department-mappings/:costLocation",
				async ({ request, params }) => {
					putCostLocation = String(params.costLocation);
					putBody = await request.json();
					return HttpResponse.json({
						cost_location: "82",
						department: "Membership",
						bereich: "ideell",
						note: null,
					});
				},
			),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceDepartmentMappings(),
		);
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		act(() =>
			result.current.saveMapping({
				costLocation: "82",
				department: "Membership",
				bereich: "ideell",
			}),
		);

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Zuordnung gespeichert.",
				"success",
			),
		);
		expect(putCostLocation).toBe("82");
		expect(putBody).toMatchObject({
			department: "Membership",
			bereich: "ideell",
		});
	});
});
