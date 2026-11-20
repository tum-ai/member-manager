import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
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
});
