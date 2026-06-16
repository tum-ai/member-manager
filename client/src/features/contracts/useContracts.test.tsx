import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "../../test/mswServer";
import { renderHookWithClient } from "../../test/renderWithClient";
import {
	useContractSubmissions,
	useContractTemplates,
	useCreateContractSubmission,
	useCreateContractTemplate,
} from "./useContracts";

vi.mock("../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

describe("useContracts", () => {
	it("fetches templates from /api/contracts/templates", async () => {
		server.use(
			http.get("/api/contracts/templates", () =>
				HttpResponse.json([{ id: "tmpl-1", name: "NDA" }]),
			),
		);

		const { result } = renderHookWithClient(() => useContractTemplates());

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual([{ id: "tmpl-1", name: "NDA" }]);
	});

	it("fetches submissions from /api/contracts/submissions", async () => {
		server.use(
			http.get("/api/contracts/submissions", () =>
				HttpResponse.json([{ id: "sub-1" }]),
			),
		);

		const { result } = renderHookWithClient(() => useContractSubmissions());

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual([{ id: "sub-1" }]);
	});

	it("POSTs a new template to /api/contracts/templates", async () => {
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

	it("POSTs a new submission to /api/contracts/submissions", async () => {
		let body: unknown = null;
		server.use(
			http.post("/api/contracts/submissions", async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ id: "sub-2" });
			}),
		);

		const { result } = renderHookWithClient(() =>
			useCreateContractSubmission(),
		);

		await result.current.mutateAsync({
			template_id: "tmpl-1",
			form_data: { foo: "bar" },
			status: "submitted",
		});

		expect(body).toEqual({
			template_id: "tmpl-1",
			form_data: { foo: "bar" },
			status: "submitted",
		});
	});
});
