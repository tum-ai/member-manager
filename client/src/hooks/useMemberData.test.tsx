import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "../test/mswServer";
import { renderHookWithClient } from "../test/renderWithClient";
import { useMemberData } from "./useMemberData";

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

describe("useMemberData", () => {
	it("fetches the member from /api/members/:id", async () => {
		server.use(
			http.get("/api/members/user-1", () =>
				HttpResponse.json({ id: "user-1", first_name: "Ada" }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberData("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.member).toEqual({ id: "user-1", first_name: "Ada" });
		expect(result.current.error).toBeNull();
	});

	it("sends a PUT with the JSON payload when updating", async () => {
		let captured: { method: string; body: unknown } | null = null;
		server.use(
			http.get("/api/members/user-1", () =>
				HttpResponse.json({ id: "user-1" }),
			),
			http.put("/api/members/user-1", async ({ request }) => {
				captured = { method: request.method, body: await request.json() };
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() => useMemberData("user-1"));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await result.current.updateMemberAsync({ given_name: "Grace" });

		await waitFor(() => expect(captured).not.toBeNull());
		expect(captured).toEqual({
			method: "PUT",
			body: { given_name: "Grace" },
		});
	});
});
