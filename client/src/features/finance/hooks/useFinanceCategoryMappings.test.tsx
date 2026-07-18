import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceCategoryMappings } from "./useFinanceCategoryMappings";

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

function categoryMappingsResponse() {
	return {
		rows: [
			{
				cost_location_two: "1",
				label: null,
				note: null,
				posting_count: 3,
				net: -840,
				sample_texts: ["Catering"],
			},
		],
		generated_at: "2026-07-18T12:00:00.000Z",
	};
}

describe("useFinanceCategoryMappings", () => {
	it("loads category rows and surfaces unlabelled ones", async () => {
		server.use(
			http.get("/api/finance/category-mappings", () =>
				HttpResponse.json(categoryMappingsResponse()),
			),
		);

		const { result } = renderHookWithClient(() => useFinanceCategoryMappings());

		await waitFor(() => expect(result.current.rows.length).toBe(1));
		expect(result.current.rows[0].label).toBeNull();
	});

	it("saves a category via PUT and toasts on success", async () => {
		showToast.mockClear();
		let putBody: unknown = null;
		let putCostLocationTwo = "";
		server.use(
			http.get("/api/finance/category-mappings", () =>
				HttpResponse.json(categoryMappingsResponse()),
			),
			http.put(
				"/api/finance/category-mappings/:costLocationTwo",
				async ({ request, params }) => {
					putCostLocationTwo = String(params.costLocationTwo);
					putBody = await request.json();
					return HttpResponse.json({
						cost_location_two: "1",
						label: "Catering",
						note: null,
					});
				},
			),
		);

		const { result } = renderHookWithClient(() => useFinanceCategoryMappings());
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		act(() =>
			result.current.saveCategory({
				costLocationTwo: "1",
				label: "Catering",
			}),
		);

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Kategorie gespeichert.",
				"success",
			),
		);
		expect(putCostLocationTwo).toBe("1");
		expect(putBody).toMatchObject({ label: "Catering" });
	});
});
