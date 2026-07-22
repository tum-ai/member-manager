import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceDepartmentMappings } from "./useFinanceDepartmentMappings";

const showToast = vi.fn();
const range = { dateFrom: "2025-01-01", dateTo: "2025-12-31" };

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
		let requestedUrl = "";
		server.use(
			http.get("/api/finance/department-mappings", ({ request }) => {
				requestedUrl = request.url;
				return HttpResponse.json(mappingsResponse());
			}),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceDepartmentMappings(range),
		);

		await waitFor(() => expect(result.current.rows.length).toBe(1));
		expect(result.current.rows[0].department).toBeNull();
		expect(requestedUrl).toContain("date_from=2025-01-01");
		expect(requestedUrl).toContain("date_to=2025-12-31");
	});

	it("saves a mapping via PUT, preserves notes, and toasts on success", async () => {
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
			useFinanceDepartmentMappings(range),
		);
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		await act(async () => {
			await result.current.saveMapping({
				costLocation: "82",
				department: "Membership",
				bereich: "ideell",
				note: "Membership fees",
			});
		});

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
			note: "Membership fees",
		});
	});

	it("serializes mapping writes and reports failures without a success toast", async () => {
		showToast.mockClear();
		let activeRequests = 0;
		let maxActiveRequests = 0;
		let releaseFirst: (() => void) | undefined;
		const firstPending = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		let requestCount = 0;

		server.use(
			http.get("/api/finance/department-mappings", () =>
				HttpResponse.json(mappingsResponse()),
			),
			http.put(
				"/api/finance/department-mappings/:costLocation",
				async ({ params }) => {
					requestCount += 1;
					activeRequests += 1;
					maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
					if (requestCount === 1) {
						await firstPending;
						activeRequests -= 1;
						return HttpResponse.json({
							cost_location: params.costLocation,
							department: "Makeathon",
							bereich: "wirtschaftlich",
							note: null,
						});
					}
					activeRequests -= 1;
					return HttpResponse.json({ error: "save failed" }, { status: 500 });
				},
			),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceDepartmentMappings(range),
		);
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		let firstSave = Promise.resolve<unknown>(undefined);
		let secondSave = Promise.resolve<unknown>(undefined);
		act(() => {
			firstSave = result.current.saveMapping({
				costLocation: "82",
				department: "Makeathon",
				bereich: "wirtschaftlich",
				note: null,
			});
			secondSave = result.current.saveMapping({
				costLocation: "83",
				department: "Legal & Finance",
				bereich: "ideell",
				note: null,
			});
		});

		await waitFor(() => expect(requestCount).toBe(1));
		releaseFirst?.();
		await act(async () => {
			await firstSave;
			await expect(secondSave).rejects.toThrow("save failed");
		});

		expect(maxActiveRequests).toBe(1);
		expect(showToast).toHaveBeenCalledWith("Zuordnung gespeichert.", "success");
		expect(showToast).toHaveBeenCalledWith("save failed", "error");
	});
});
