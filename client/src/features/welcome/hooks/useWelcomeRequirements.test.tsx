import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useWelcomeRequirements } from "./useWelcomeRequirements";

vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const decided = { consents_decided_at: "2026-09-01T00:00:00Z" };
const undecided = { consents_decided_at: null };
const cv = { id: "cv-1" };

function stub({
	consents = decided as Record<string, unknown>,
	currentCv = cv as Record<string, unknown> | null,
	memberStatus = "active",
	cvStatus = 200,
} = {}) {
	server.use(
		http.get("/api/members/:id/consents", () => HttpResponse.json(consents)),
		http.get("/api/members/:id/cv", () =>
			HttpResponse.json(
				cvStatus === 200 ? { cv: currentCv } : { error: "Database error" },
				{ status: cvStatus },
			),
		),
		http.get("/api/members/:id", () =>
			HttpResponse.json({ member_status: memberStatus }),
		),
	);
}

describe("useWelcomeRequirements", () => {
	it("is complete for an active member who decided and has a CV", async () => {
		stub();
		const { result } = renderHookWithClient(() =>
			useWelcomeRequirements("user-1"),
		);

		expect(result.current.status).toBe("loading");
		await waitFor(() => expect(result.current.status).toBe("complete"));
	});

	it("asks an active member for both the decision and the CV", async () => {
		stub({ consents: undecided, currentCv: null });
		const { result } = renderHookWithClient(() =>
			useWelcomeRequirements("user-1"),
		);

		await waitFor(() =>
			expect(result.current).toEqual({
				status: "incomplete",
				needsConsentDecision: true,
				needsCv: true,
			}),
		);
	});

	it("only asks alumni for the decision", async () => {
		stub({ consents: undecided, currentCv: null, memberStatus: "alumni" });
		const { result } = renderHookWithClient(() =>
			useWelcomeRequirements("user-1"),
		);

		await waitFor(() =>
			expect(result.current).toEqual({
				status: "incomplete",
				needsConsentDecision: true,
				needsCv: false,
			}),
		);
	});

	it("reports unknown instead of incomplete when a lookup fails", async () => {
		stub({ cvStatus: 500 });
		const { result } = renderHookWithClient(() =>
			useWelcomeRequirements("user-1"),
		);

		await waitFor(() => expect(result.current.status).toBe("unknown"), {
			timeout: 5000,
		});
	});
});
