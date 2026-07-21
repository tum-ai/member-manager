import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import {
	useContractTemplates,
	useCreateContractTemplate,
} from "./useContractTemplates";

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

describe("contract template hooks", () => {
	it("fetches templates", async () => {
		server.use(
			http.get("/api/contracts/templates", () =>
				HttpResponse.json([{ id: "tmpl-1", name: "NDA" }]),
			),
		);

		const { result } = renderHookWithClient(() => useContractTemplates());

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual([{ id: "tmpl-1", name: "NDA" }]);
	});

	it("creates a template", async () => {
		let body: unknown = null;
		server.use(
			http.post("/api/contracts/templates", async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ id: "tmpl-2", name: "Sponsorship" });
			}),
		);

		const { result } = renderHookWithClient(() => useCreateContractTemplate());
		const created = await result.current.mutateAsync({ name: "Sponsorship" });

		expect(body).toEqual({ name: "Sponsorship" });
		expect(created.id).toBe("tmpl-2");
	});
});
