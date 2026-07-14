import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useContractTemplatesPage } from "./useContractTemplatesPage";

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

const template = {
	id: "tmpl-1",
	name: "Sponsorship",
	description: null,
	contract_text: "Hello {{name}}",
	is_active: true,
	created_at: "2026-07-01T00:00:00Z",
	updated_at: "2026-07-01T00:00:00Z",
};

describe("useContractTemplatesPage", () => {
	it("selects, edits, and saves a template through one page model", async () => {
		let updateBody: unknown = null;
		server.use(
			http.get("/api/contracts/templates", () => HttpResponse.json([template])),
			http.get("/api/contracts/templates/tmpl-1", () =>
				HttpResponse.json({
					template,
					variables: [],
					blocks: [],
				}),
			),
			http.patch("/api/contracts/templates/tmpl-1", async ({ request }) => {
				updateBody = await request.json();
				return HttpResponse.json({ ...template, name: "Updated" });
			}),
		);

		const { result } = renderHookWithClient(() => useContractTemplatesPage());

		await waitFor(() => expect(result.current.selectedId).toBe("tmpl-1"));
		await waitFor(() => expect(result.current.editor.draft).not.toBeNull());

		act(() => {
			const draft = result.current.editor.draft;
			if (draft) result.current.editor.setDraft({ ...draft, name: "Updated" });
		});
		expect(result.current.editor.dirty).toBe(true);

		act(() => result.current.editor.save());

		await waitFor(() =>
			expect(updateBody).toMatchObject({
				name: "Updated",
				contract_text: "Hello {{name}}",
				is_active: true,
			}),
		);
	});
});
