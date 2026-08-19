import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useContractTemplatesPage } from "./useContractTemplatesPage";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

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
			http.get("/api/contracts/docx-readiness", () =>
				HttpResponse.json({
					ready: false,
					active_docx_templates: 0,
					legacy_templates: 1,
					pending_template_documents: 0,
					failed_template_documents: 0,
					pending_render_jobs: 0,
					failed_render_jobs: 0,
					legacy_submissions_without_pdf: 0,
					reasons: ["Upload a DOCX"],
				}),
			),
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

	it("uploads and automatically activates a ready DOCX version", async () => {
		let uploaded = false;
		let activatedDocumentId: string | null = null;
		const document = {
			id: "doc-2",
			template_id: "tmpl-1",
			version: 2,
			status: "ready",
			source_bucket: "templates",
			source_path: "tmpl-1/2.docx",
			original_filename: "contract.docx",
			source_size_bytes: 100,
			source_sha256: "abc123",
			preview_bucket: "previews",
			preview_path: "tmpl-1/2.pdf",
			preview_size_bytes: 80,
			preview_sha256: "pdf123",
			placeholder_manifest: {},
			validation_issues: [],
			signature_anchors: [],
			converter_version: "1.0.0",
			error_code: null,
			error_message: null,
			uploaded_by_user_id: "user-1",
			activated_at: null,
			created_at: "2026-08-19T00:00:00Z",
			updated_at: "2026-08-19T00:00:00Z",
		};
		server.use(
			http.get("/api/contracts/docx-readiness", () =>
				HttpResponse.json({
					ready: false,
					active_docx_templates: 0,
					legacy_templates: 1,
					pending_template_documents: 0,
					failed_template_documents: 0,
					pending_render_jobs: 0,
					failed_render_jobs: 0,
					legacy_submissions_without_pdf: 0,
					reasons: [],
				}),
			),
			http.get("/api/contracts/templates", () => HttpResponse.json([template])),
			http.get("/api/contracts/templates/tmpl-1", () =>
				HttpResponse.json({
					template,
					variables: [],
					blocks: [],
					documents: uploaded ? [document] : [],
				}),
			),
			http.post(
				"/api/contracts/templates/tmpl-1/documents",
				async ({ request }) => {
					expect(request.headers.get("content-type")).toContain(
						"multipart/form-data",
					);
					await request.arrayBuffer();
					uploaded = true;
					return HttpResponse.json(document);
				},
			),
			http.post(
				"/api/contracts/templates/tmpl-1/documents/doc-2/activate",
				() => {
					activatedDocumentId = "doc-2";
					return HttpResponse.json({
						...template,
						active_document_id: "doc-2",
					});
				},
			),
		);

		const { result } = renderHookWithClient(() => useContractTemplatesPage());
		await waitFor(() => expect(result.current.selectedId).toBe("tmpl-1"));

		act(() => {
			result.current.editor.uploadDocument(
				new File(["docx"], "contract.docx", {
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				}),
			);
		});

		await waitFor(() => expect(activatedDocumentId).toBe("doc-2"));
		expect(showToast).toHaveBeenCalledWith(
			"DOCX version is ready and active",
			"success",
		);
	});
});
