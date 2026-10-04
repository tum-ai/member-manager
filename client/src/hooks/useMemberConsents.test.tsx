import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { memberConsentsQueryKey, useMemberConsents } from "./useMemberConsents";

vi.mock("../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const undecided = {
	privacy_policy_agreed: false,
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: false,
	consents_decided_at: null,
};

const decision = {
	privacy_policy_agreed: true,
	website_profile_consent: false,
	event_photos_consent: true,
	partner_sharing_consent: true,
};

describe("useMemberConsents", () => {
	it("loads the member's consents", async () => {
		server.use(
			http.get("/api/members/:id/consents", () => HttpResponse.json(undecided)),
		);

		const { result } = renderHookWithClient(() => useMemberConsents("user-1"));

		await waitFor(() => expect(result.current.consents).toEqual(undecided));
		expect(result.current.isLoading).toBe(false);
	});

	it("saves a decision, caches the response and refreshes dependent queries", async () => {
		const saved = { ...decision, consents_decided_at: "2026-10-04T10:00:00Z" };
		let putBody: unknown;
		server.use(
			http.get("/api/members/:id/consents", () => HttpResponse.json(undecided)),
			http.put("/api/members/:id/consents", async ({ request }) => {
				putBody = await request.json();
				return HttpResponse.json(saved);
			}),
		);

		const { result, queryClient } = renderHookWithClient(() =>
			useMemberConsents("user-1"),
		);
		await waitFor(() => expect(result.current.consents).toBeDefined());
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		await act(async () => {
			await result.current.saveConsentsAsync(decision);
		});

		expect(putBody).toEqual(decision);
		expect(queryClient.getQueryData(memberConsentsQueryKey("user-1"))).toEqual(
			saved,
		);
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["member-cv-consent", "user-1"],
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sepa", "user-1"] });
	});

	it("surfaces a failed save", async () => {
		server.use(
			http.get("/api/members/:id/consents", () => HttpResponse.json(undecided)),
			http.put("/api/members/:id/consents", () =>
				HttpResponse.json({ error: "Database error" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberConsents("user-1"));
		await waitFor(() => expect(result.current.consents).toBeDefined());

		await expect(result.current.saveConsentsAsync(decision)).rejects.toThrow();
	});
});
