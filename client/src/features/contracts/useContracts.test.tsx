import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import {
	fetchPublicBoardSignPayload,
	postPublicBoardSignature,
	useContractStatusEvents,
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

	it("fetches status events from /api/contracts/submissions/:id/status-events", async () => {
		server.use(
			http.get("/api/contracts/submissions/sub-1/status-events", () =>
				HttpResponse.json([
					{
						id: "evt-1",
						submission_id: "sub-1",
						from_status: "legal_review",
						to_status: "approved",
						changed_by: null,
						changed_by_name: "Ada Admin",
						note: null,
						created_at: "2026-07-01T00:00:00Z",
					},
				]),
			),
		);

		const { result } = renderHookWithClient(() =>
			useContractStatusEvents("sub-1"),
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.[0]?.to_status).toBe("approved");
	});

	it("fetches and posts the public board-signing payload", async () => {
		server.use(
			http.get("/api/contracts/board-sign/board-token", () =>
				HttpResponse.json({
					contract_text: "Body",
					html: "<section>Body</section>",
					pages: ["Body"],
					status: "partner_signed",
					partner_signer_name: "Jane",
					partner_signature_data: "data:image/png;base64,AAAA",
					partner_signed_at: "2026-07-01T00:00:00Z",
				}),
			),
		);
		let posted: unknown = null;
		server.use(
			http.post(
				"/api/contracts/board-sign/board-token",
				async ({ request }) => {
					posted = await request.json();
					return HttpResponse.json({ id: "sub-1", status: "board_signed" });
				},
			),
		);

		const payload = await fetchPublicBoardSignPayload("board-token");
		expect(payload.partner_signer_name).toBe("Jane");

		await postPublicBoardSignature("board-token", {
			signature_data: "data:image/png;base64,BBBB",
			signer_name: "Board Member",
		});
		expect(posted).toEqual({
			signature_data: "data:image/png;base64,BBBB",
			signer_name: "Board Member",
		});
	});
});
