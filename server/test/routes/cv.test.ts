import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import {
	assertValidCvPdf,
	cvStoragePath,
	MAX_CV_BYTES,
	sanitizeCvFilename,
	sha256Hex,
} from "../../src/lib/memberCvs.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";

const PDF_BYTES = Buffer.from("%PDF-1.4\n%mock pdf\n");
const PDF_BASE64 = PDF_BYTES.toString("base64");

describe("memberCvs lib", () => {
	it("accepts a valid PDF buffer", () => {
		assert.doesNotThrow(() => assertValidCvPdf(PDF_BYTES));
	});

	it("rejects empty, oversized, and non-PDF buffers", () => {
		assert.throws(() => assertValidCvPdf(Buffer.alloc(0)), /empty/);
		assert.throws(
			() => assertValidCvPdf(Buffer.from("not a pdf at all")),
			/PDF/,
		);
		const tooBig = Buffer.alloc(MAX_CV_BYTES + 1);
		PDF_BYTES.copy(tooBig);
		assert.throws(() => assertValidCvPdf(tooBig), /too large/);
	});

	it("computes a stable sha256", () => {
		assert.equal(sha256Hex(PDF_BYTES), sha256Hex(Buffer.from(PDF_BYTES)));
		assert.match(sha256Hex(PDF_BYTES), /^[0-9a-f]{64}$/);
	});

	it("sanitizes filenames to a .pdf", () => {
		assert.equal(sanitizeCvFilename("My CV!.pdf"), "My_CV.pdf");
		assert.equal(sanitizeCvFilename("resume"), "resume.pdf");
		assert.equal(sanitizeCvFilename(""), "cv.pdf");
	});

	it("builds the immutable storage path", () => {
		assert.equal(cvStoragePath("user-1", "cv-9"), "user-1/cv-9.pdf");
	});
});

describe("CV routes", () => {
	before(async () => {
		await getTestApp();
	});
	afterEach(() => {
		resetDatabase();
	});
	after(async () => {
		await closeTestApp();
	});

	it("returns null current CV before any upload", async () => {
		const app = await getTestApp();
		const res = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
		});
		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.json(), { cv: null });
	});

	it("uploads a CV as version 1 then supersedes with version 2", async () => {
		const app = await getTestApp();

		const first = await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
			payload: { filename: "first.pdf", cv_base64: PDF_BASE64 },
		});
		assert.equal(first.statusCode, 201);
		assert.equal(first.json().cv.version, 1);
		assert.equal(first.json().cv.source, "member_upload");
		assert.equal(first.json().cv.is_current, true);

		const second = await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
			payload: { filename: "second.pdf", cv_base64: PDF_BASE64 },
		});
		assert.equal(second.statusCode, 201);
		assert.equal(second.json().cv.version, 2);

		const current = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
		});
		assert.equal(current.json().cv.version, 2);
		assert.equal(current.json().cv.original_filename, "second.pdf");
	});

	it("rejects a non-PDF upload", async () => {
		const app = await getTestApp();
		const res = await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
			payload: {
				filename: "x.pdf",
				cv_base64: Buffer.from("nope").toString("base64"),
			},
		});
		assert.equal(res.statusCode, 400);
	});

	it("forbids uploading another member's CV", async () => {
		const app = await getTestApp();
		const res = await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.otherUser),
			payload: { filename: "x.pdf", cv_base64: PDF_BASE64 },
		});
		assert.equal(res.statusCode, 403);
	});

	it("records an admin upload for another member as admin_upload", async () => {
		const app = await getTestApp();
		const res = await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.admin),
			payload: { filename: "admin.pdf", cv_base64: PDF_BASE64 },
		});
		assert.equal(res.statusCode, 201);
		assert.equal(res.json().cv.source, "admin_upload");
	});

	it("downloads the current CV bytes", async () => {
		const app = await getTestApp();
		await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
			payload: { filename: "first.pdf", cv_base64: PDF_BASE64 },
		});
		const res = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}/cv/current/download`,
			headers: authHeaders(testTokens.user),
		});
		assert.equal(res.statusCode, 200);
		assert.equal(res.headers["content-type"], "application/pdf");
		assert.ok(res.rawPayload.equals(PDF_BYTES));
	});

	it("sets and clears partner-sharing consent", async () => {
		const app = await getTestApp();
		const set = await app.inject({
			method: "PUT",
			url: `/api/members/${testUserIds.user}/cv/consent`,
			headers: authHeaders(testTokens.user),
			payload: { consent: true },
		});
		assert.equal(set.statusCode, 200);
		assert.ok(set.json().partner_sharing_consent_at);

		const clear = await app.inject({
			method: "PUT",
			url: `/api/members/${testUserIds.user}/cv/consent`,
			headers: authHeaders(testTokens.user),
			payload: { consent: false },
		});
		assert.equal(clear.json().partner_sharing_consent_at, null);
	});
});

describe("partner export", () => {
	const ORIGINAL_TOKEN = process.env.PARTNER_EXPORT_TOKEN;
	before(async () => {
		process.env.PARTNER_EXPORT_TOKEN = "test-export-token";
		await getTestApp();
	});
	afterEach(() => {
		resetDatabase();
	});
	after(async () => {
		if (ORIGINAL_TOKEN === undefined) {
			delete process.env.PARTNER_EXPORT_TOKEN;
		} else {
			process.env.PARTNER_EXPORT_TOKEN = ORIGINAL_TOKEN;
		}
		await closeTestApp();
	});

	it("rejects a missing or wrong token", async () => {
		const app = await getTestApp();
		const noToken = await app.inject({
			method: "GET",
			url: "/api/internal/partner-portal/cv-export",
		});
		assert.equal(noToken.statusCode, 401);

		const wrong = await app.inject({
			method: "GET",
			url: "/api/internal/partner-portal/cv-export",
			headers: { authorization: "Bearer nope" },
		});
		assert.equal(wrong.statusCode, 401);
	});

	it("exports only consented active members with a current CV", async () => {
		const app = await getTestApp();

		// Upload + consent for the regular member.
		await app.inject({
			method: "POST",
			url: `/api/members/${testUserIds.user}/cv`,
			headers: authHeaders(testTokens.user),
			payload: { filename: "cv.pdf", cv_base64: PDF_BASE64 },
		});
		await app.inject({
			method: "PUT",
			url: `/api/members/${testUserIds.user}/cv/consent`,
			headers: authHeaders(testTokens.user),
			payload: { consent: true },
		});

		const res = await app.inject({
			method: "GET",
			url: "/api/internal/partner-portal/cv-export?semester=SS26",
			headers: { authorization: "Bearer test-export-token" },
		});
		assert.equal(res.statusCode, 200);
		const body = res.json();
		assert.equal(body.semester, "SS26");
		assert.equal(body.members.length, 1);
		const entry = body.members[0];
		assert.equal(entry.member_manager_user_id, testUserIds.user);
		assert.ok(entry.cv.download_url.startsWith("https://"));
		assert.match(entry.cv.sha256, /^[0-9a-f]{64}$/);
	});
});
