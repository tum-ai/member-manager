import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceAccountLabels } from "./useFinanceAccountLabels";

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

function accountLabelsResponse() {
	return {
		rows: [
			{
				account: "6840",
				label: null,
				note: null,
				posting_count: 9,
				net: -3900,
				sample_texts: ["Vercel", "Notion"],
			},
		],
		generated_at: "2026-07-18T12:00:00.000Z",
	};
}

describe("useFinanceAccountLabels", () => {
	it("loads account rows and surfaces unlabelled ones", async () => {
		server.use(
			http.get("/api/finance/account-labels", () =>
				HttpResponse.json(accountLabelsResponse()),
			),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceAccountLabels(range),
		);

		await waitFor(() => expect(result.current.rows.length).toBe(1));
		expect(result.current.rows[0].label).toBeNull();
	});

	it("saves an account label via PUT and toasts on success", async () => {
		showToast.mockClear();
		let putBody: unknown = null;
		let putAccount = "";
		server.use(
			http.get("/api/finance/account-labels", () =>
				HttpResponse.json(accountLabelsResponse()),
			),
			http.put(
				"/api/finance/account-labels/:account",
				async ({ request, params }) => {
					putAccount = String(params.account);
					putBody = await request.json();
					return HttpResponse.json({
						account: "6840",
						label: "Software & Tools",
						note: null,
					});
				},
			),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceAccountLabels(range),
		);
		await waitFor(() => expect(result.current.rows.length).toBe(1));

		await act(async () => {
			await result.current.saveAccount({
				account: "6840",
				label: "Software & Tools",
				note: "Software expenses",
			});
		});

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Ledger account label saved.",
				"success",
			),
		);
		expect(putAccount).toBe("6840");
		expect(putBody).toMatchObject({
			label: "Software & Tools",
			note: "Software expenses",
		});
	});
});
