import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { CONTRACT_DOCX_MIME_TYPE } from "@member-manager/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ValidationError } from "../../src/lib/errors.js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { assertUploadBelongsTo, createContractUploadUrl, downloadUploadedDocx } =
	await import("../../src/lib/contracts/contractUploads.js");
const { getSupabase, setSupabaseClient } = await import(
	"../../src/lib/supabase.js"
);

const originalClient = getSupabase();

function storageClient(objects: Record<string, Buffer>): SupabaseClient {
	return {
		storage: {
			from: () => ({
				createSignedUploadUrl: async (path: string) => ({
					data: {
						path,
						token: `token-${path}`,
						signedUrl: `https://storage.test/${path}`,
					},
					error: null,
				}),
				download: async (path: string) =>
					objects[path]
						? { data: new Blob([objects[path]]), error: null }
						: { data: null, error: { message: "not found" } },
			}),
		},
	} as unknown as SupabaseClient;
}

describe("contract direct uploads", () => {
	afterEach(() => setSupabaseClient(originalClient));

	it("mints a ticket at the artifact's final location", async () => {
		setSupabaseClient(storageClient({}));
		const ticket = await createContractUploadUrl({
			bucket: "contract-template-documents",
			path: "tmpl-1/doc-1/source.docx",
			mimeType: CONTRACT_DOCX_MIME_TYPE,
			sizeBytes: 1024,
		});
		assert.equal(ticket.bucket, "contract-template-documents");
		assert.equal(ticket.path, "tmpl-1/doc-1/source.docx");
		assert.ok(ticket.token);
	});

	it("refuses a non-DOCX mime type", async () => {
		setSupabaseClient(storageClient({}));
		await assert.rejects(
			() =>
				createContractUploadUrl({
					bucket: "contract-template-documents",
					path: "tmpl-1/doc-1/source.docx",
					mimeType: "application/pdf",
					sizeBytes: 1024,
				}),
			(error: unknown) => error instanceof ValidationError,
		);
	});

	it("refuses a declared size over the limit", async () => {
		setSupabaseClient(storageClient({}));
		await assert.rejects(
			() =>
				createContractUploadUrl({
					bucket: "contract-template-documents",
					path: "tmpl-1/doc-1/source.docx",
					mimeType: CONTRACT_DOCX_MIME_TYPE,
					sizeBytes: 21 * 1024 * 1024,
				}),
			(error: unknown) => error instanceof ValidationError,
		);
	});

	it("stops a ticket for one record being claimed against another", () => {
		assert.throws(
			() => assertUploadBelongsTo("tmpl-1", "tmpl-2/doc-1/source.docx"),
			(error: unknown) => error instanceof ValidationError,
		);
		assert.doesNotThrow(() =>
			assertUploadBelongsTo("tmpl-1", "tmpl-1/doc-1/source.docx"),
		);
	});

	it("re-checks the real size, since the declared one is advisory", async () => {
		// Nothing stops the browser PUTting something bigger than it declared when
		// the ticket was minted, so the bytes are measured again on the way in.
		const oversized = Buffer.alloc(21 * 1024 * 1024);
		setSupabaseClient(storageClient({ "tmpl-1/doc-1/source.docx": oversized }));
		await assert.rejects(
			() =>
				downloadUploadedDocx({
					bucket: "contract-template-documents",
					path: "tmpl-1/doc-1/source.docx",
				}),
			(error: unknown) => error instanceof ValidationError,
		);
	});

	it("reports a missing staged object as a user-fixable error", async () => {
		setSupabaseClient(storageClient({}));
		await assert.rejects(
			() =>
				downloadUploadedDocx({
					bucket: "contract-template-documents",
					path: "tmpl-1/gone/source.docx",
				}),
			(error: unknown) =>
				error instanceof ValidationError &&
				/choose the file again/i.test(error.message),
		);
	});
});
