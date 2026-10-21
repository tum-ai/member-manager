import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceTAccountActions } from "./useFinanceTAccountActions";

const showToast = vi.fn();

vi.mock("@/contexts/ToastContext", () => ({
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

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function bulkHandler(
	results: Array<{
		posting_external_id: string;
		applied: boolean;
		reason: string | null;
	}>,
) {
	return http.post("/api/finance/posting-allocations/bulk", () =>
		HttpResponse.json({
			project_id: PROJECT_ID,
			applied_count: results.filter((result) => result.applied).length,
			skipped_count: results.filter((result) => !result.applied).length,
			results,
		}),
	);
}

function renderActions(onApplied: () => void) {
	return renderHookWithClient(() =>
		useFinanceTAccountActions({
			department: "Makeathon",
			period: { type: "year", key: "2026" },
			onApplied,
		}),
	);
}

describe("useFinanceTAccountActions", () => {
	beforeEach(() => {
		showToast.mockClear();
	});

	it("clears the selection when every posting was assigned", async () => {
		const onApplied = vi.fn();
		server.use(
			bulkHandler([
				{ posting_external_id: "BB-1", applied: true, reason: null },
				{ posting_external_id: "BB-2", applied: true, reason: null },
			]),
		);

		const { result } = renderActions(onApplied);
		await result.current.assignToProject({
			projectId: PROJECT_ID,
			postingExternalIds: ["BB-1", "BB-2"],
		});

		await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
		expect(showToast).toHaveBeenCalledWith(
			"2 Buchungen zugeordnet.",
			"success",
		);
	});

	it("clears the selection on a partial success and names the skips", async () => {
		const onApplied = vi.fn();
		server.use(
			bulkHandler([
				{ posting_external_id: "BB-1", applied: true, reason: null },
				{
					posting_external_id: "BB-2",
					applied: false,
					reason: "already_split",
				},
			]),
		);

		const { result } = renderActions(onApplied);
		await result.current.assignToProject({
			projectId: PROJECT_ID,
			postingExternalIds: ["BB-1", "BB-2"],
		});

		// One posting landed, so the selection is consumed — but the refusal is
		// spelled out rather than swallowed.
		await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("1× bereits aufgeteilt"),
			"warning",
		);
	});

	it("keeps the selection when every posting was skipped", async () => {
		const onApplied = vi.fn();
		server.use(
			bulkHandler([
				{
					posting_external_id: "BB-1",
					applied: false,
					reason: "period_mismatch",
				},
				{ posting_external_id: "BB-2", applied: false, reason: "zero_amount" },
			]),
		);

		const { result } = renderActions(onApplied);
		await result.current.assignToProject({
			projectId: PROJECT_ID,
			postingExternalIds: ["BB-1", "BB-2"],
		});

		// All refusals arrive as a successful HTTP response. Nothing was written,
		// so the ticks must survive for the retry.
		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				expect.stringContaining("0 von 2 Buchungen zugeordnet."),
				"warning",
			),
		);
		expect(onApplied).not.toHaveBeenCalled();
	});

	it("keeps the selection when the created project took no posting", async () => {
		const onApplied = vi.fn();
		server.use(
			http.post("/api/finance/projects/from-postings", () =>
				HttpResponse.json(
					{
						project: {
							id: PROJECT_ID,
							parent_project_id: null,
							name: "Sponsoring-Kampagne",
							department: "Makeathon",
							period_type: "year",
							period_key: "2026",
							tax_area: null,
							target_amount: 0,
							status: "active",
							description: null,
							sub_team: null,
							created_at: "2026-08-09T10:00:00.000Z",
							updated_at: "2026-08-09T10:00:00.000Z",
						},
						applied_count: 0,
						skipped_count: 1,
						results: [
							{
								posting_external_id: "BB-1",
								applied: false,
								reason: "matched_elsewhere",
							},
						],
					},
					{ status: 201 },
				),
			),
		);

		const { result } = renderActions(onApplied);
		await result.current.createProject({
			name: "Sponsoring-Kampagne",
			parentProjectId: null,
			subTeam: null,
			taxArea: null,
			targetAmount: 0,
			status: "active",
			postingExternalIds: ["BB-1"],
		});

		// The project exists, so the toast says so — but the invoices are still
		// ticked, because none of them moved.
		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				expect.stringContaining('Projekt „Sponsoring-Kampagne" angelegt.'),
				"warning",
			),
		);
		expect(onApplied).not.toHaveBeenCalled();
	});

	it("sends the chosen placement when creating a project from a selection", async () => {
		const onApplied = vi.fn();
		let body: Record<string, unknown> = {};
		server.use(
			http.post("/api/finance/projects/from-postings", async ({ request }) => {
				body = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json(
					{
						project: {
							id: PROJECT_ID,
							parent_project_id: "22222222-2222-4222-8222-222222222222",
							name: "Sponsoring-Kampagne",
							department: "Makeathon",
							period_type: "year",
							period_key: "2026",
							tax_area: null,
							target_amount: 0,
							status: "active",
							description: null,
							sub_team: "Big Makeathon",
							created_at: "2026-08-09T10:00:00.000Z",
							updated_at: "2026-08-09T10:00:00.000Z",
						},
						applied_count: 1,
						skipped_count: 0,
						results: [
							{ posting_external_id: "BB-1", applied: true, reason: null },
						],
					},
					{ status: 201 },
				);
			}),
		);

		const { result } = renderActions(onApplied);
		await result.current.createProject({
			name: "Sponsoring-Kampagne",
			parentProjectId: "22222222-2222-4222-8222-222222222222",
			subTeam: "Big Makeathon",
			taxArea: null,
			targetAmount: 0,
			status: "active",
			postingExternalIds: ["BB-1"],
		});

		await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
		expect(body.parent_project_id).toBe("22222222-2222-4222-8222-222222222222");
		expect(body.sub_team).toBe("Big Makeathon");
		expect(body.posting_external_ids).toEqual(["BB-1"]);
	});
});
