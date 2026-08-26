import type { User } from "@supabase/supabase-js";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useExpertiseProfilePage } from "./useExpertiseProfilePage";

const showToast = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ showToast }) }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const user = {
	id: USER_ID,
	email: "ada@example.com",
	user_metadata: {},
} as unknown as User;
const profile = {
	user_id: USER_ID,
	editable: true,
	opted_out: false,
	person: {
		user_id: USER_ID,
		headline: "Builder",
		summary: "Ships products",
		opted_out: false,
		consent_at: null,
		last_enriched_at: null,
	},
	member: {
		user_id: USER_ID,
		given_name: "Ada",
		surname: "Lovelace",
		department: "Tech",
		batch: null,
		member_role: "Member",
		board_role: null,
		avatar_url: null,
		linkedin_profile_url: null,
		linkedin_url: null,
		public_location: null,
		member_status: "active",
	},
	employment: [],
	education: [],
	projects: [],
	tags: [],
	skills: [
		{
			id: CLAIM_ID,
			user_id: USER_ID,
			confidence: 0.7,
			status: "pending",
			raw_value: "Swift",
			source: null,
			created_at: "2026-01-01",
			updated_at: "2026-01-01",
			skill_id: "33333333-3333-4333-8333-333333333333",
			proficiency: "advanced",
			skill: {
				id: "33333333-3333-4333-8333-333333333333",
				name: "Swift",
				category: "Mobile",
			},
		},
	],
	counts: { confirmed: 0, pending: 1, rejected: 0 },
};

describe("useExpertiseProfilePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		server.use(
			http.get(`/api/expertise/${USER_ID}`, () => HttpResponse.json(profile)),
			http.get("/api/expertise/meta/tags", () =>
				HttpResponse.json({ tags: [] }),
			),
		);
	});

	it("keeps pending claims visible as review rows", async () => {
		const { result } = renderHookWithClient(() =>
			useExpertiseProfilePage({ user }),
		);
		await waitFor(() => expect(result.current.profile).toBeDefined());
		expect(result.current.pendingRows).toHaveLength(1);
		expect(result.current.pendingRows[0]?.status).toBe("pending");
		expect(result.current.rowsByType("skill")).toHaveLength(0);
	});

	it("reports edit mutation state and closes the dialog after success", async () => {
		let finish: (() => void) | undefined;
		server.use(
			http.patch(
				`/api/expertise/${USER_ID}/claims/skill/${CLAIM_ID}`,
				async () => {
					await new Promise<void>((resolve) => {
						finish = resolve;
					});
					return HttpResponse.json({ claim: {} });
				},
			),
		);
		const { result } = renderHookWithClient(() =>
			useExpertiseProfilePage({ user }),
		);
		await waitFor(() => expect(result.current.pendingRows).toHaveLength(1));
		act(() => result.current.openEdit(result.current.pendingRows[0]));
		let saving: Promise<void> | undefined;
		act(() => {
			saving = result.current.saveClaim({
				skill_name: "Swift",
				proficiency: "expert",
			});
		});
		await waitFor(() => expect(result.current.isSavingClaim).toBe(true));
		act(() => finish?.());
		await act(async () => {
			await saving;
		});
		expect(result.current.dialog).toBeNull();
	});

	it("reports add mutation state and closes the dialog after success", async () => {
		let finish: (() => void) | undefined;
		server.use(
			http.post(`/api/expertise/${USER_ID}/claims/skill`, async () => {
				await new Promise<void>((resolve) => {
					finish = resolve;
				});
				return HttpResponse.json({ claim: {} }, { status: 201 });
			}),
		);
		const { result } = renderHookWithClient(() =>
			useExpertiseProfilePage({ user }),
		);
		await waitFor(() => expect(result.current.profile).toBeDefined());
		act(() => result.current.openAdd("skill"));
		let saving: Promise<void> | undefined;
		act(() => {
			saving = result.current.saveClaim({ skill_name: "TypeScript" });
		});
		await waitFor(() => expect(result.current.isSavingClaim).toBe(true));
		act(() => finish?.());
		await act(async () => {
			await saving;
		});
		expect(result.current.dialog).toBeNull();
	});

	it("reports delete mutation state for the affected row", async () => {
		let finish: (() => void) | undefined;
		server.use(
			http.delete(
				`/api/expertise/${USER_ID}/claims/skill/${CLAIM_ID}`,
				async () => {
					await new Promise<void>((resolve) => {
						finish = resolve;
					});
					return new HttpResponse(null, { status: 204 });
				},
			),
		);
		const { result } = renderHookWithClient(() =>
			useExpertiseProfilePage({ user }),
		);
		await waitFor(() => expect(result.current.pendingRows).toHaveLength(1));
		const row = result.current.pendingRows[0];
		let deleting: Promise<void> | undefined;
		act(() => {
			deleting = result.current.deleteClaim(row);
		});
		await waitFor(() => expect(result.current.claimBusy(row)).toBe(true));
		act(() => finish?.());
		await act(async () => {
			await deleting;
		});
		expect(showToast).toHaveBeenCalledWith("Claim deleted.", "success");
	});
});
