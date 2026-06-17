import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useMemberCv } from "./useMemberCv";

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

const cvMetadata = {
	id: "cv-1",
	version: 1,
	source: "member_upload" as const,
	original_filename: "cv.pdf",
	size_bytes: 1234,
	mime_type: "application/pdf",
	sha256: "abc",
	uploaded_at: "2026-01-01T00:00:00Z",
	is_current: true,
};

function stubCvAndConsent(cv: unknown, consent: boolean) {
	server.use(
		http.get("/api/members/:id/cv", () => HttpResponse.json({ cv })),
		http.get("/api/members/:id/cv/consent", () =>
			HttpResponse.json({ consent }),
		),
	);
}

describe("useMemberCv", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("loads the current CV and consent flag", async () => {
		stubCvAndConsent(cvMetadata, true);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.cv).toEqual(cvMetadata);
		await waitFor(() => expect(result.current.hasConsent).toBe(true));
		expect(result.current.error).toBeNull();
	});

	it("falls back to null cv and false consent when empty", async () => {
		stubCvAndConsent(null, false);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.cv).toBeNull();
		await waitFor(() => expect(result.current.isConsentLoading).toBe(false));
		expect(result.current.hasConsent).toBe(false);
		expect(result.current.isConsentError).toBe(false);
	});

	it("surfaces the cv query error", async () => {
		server.use(
			http.get("/api/members/:id/cv", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 }),
			),
			http.get("/api/members/:id/cv/consent", () =>
				HttpResponse.json({ consent: false }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));

		await waitFor(() => expect(result.current.error).toBeTruthy());
		expect(result.current.cv).toBeNull();
	});

	it("flags consent query errors", async () => {
		server.use(
			http.get("/api/members/:id/cv", () => HttpResponse.json({ cv: null })),
			http.get("/api/members/:id/cv/consent", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));

		await waitFor(() => expect(result.current.isConsentError).toBe(true));
	});

	it("uploads a CV file as a base64 payload and invalidates the cv query", async () => {
		const captured: { body: { filename?: string; cv_base64?: string } | null } =
			{ body: null };
		stubCvAndConsent(null, false);
		server.use(
			http.post("/api/members/:id/cv", async ({ request }) => {
				captured.body = (await request.json()) as { filename?: string };
				return HttpResponse.json({ cv: cvMetadata });
			}),
		);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		const file = new File(["hello"], "cv.pdf", { type: "application/pdf" });
		await result.current.uploadCv(file);

		await waitFor(() => expect(captured.body).not.toBeNull());
		expect(captured.body?.filename).toBe("cv.pdf");
		expect(captured.body?.cv_base64).toMatch(/^data:/);
		expect(result.current.uploadError).toBeNull();
	});

	it("exposes the upload error when the POST fails", async () => {
		stubCvAndConsent(null, false);
		server.use(
			http.post("/api/members/:id/cv", () =>
				HttpResponse.json({ error: "too big" }, { status: 413 }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		const file = new File(["hello"], "cv.pdf", { type: "application/pdf" });
		await expect(result.current.uploadCv(file)).rejects.toThrow();
		await waitFor(() => expect(result.current.uploadError).toBeTruthy());
	});

	it("fetchCvBlob returns the downloaded blob with an auth header", async () => {
		stubCvAndConsent(cvMetadata, true);
		let authHeader: string | null = null;
		server.use(
			http.get("/api/members/:id/cv/current/download", ({ request }) => {
				authHeader = request.headers.get("Authorization");
				return HttpResponse.arrayBuffer(new ArrayBuffer(4));
			}),
		);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		const blob = await result.current.fetchCvBlob();
		expect(blob).toBeInstanceOf(Blob);
		expect(authHeader).toBe("Bearer test-token");
	});

	it("fetchCvBlob throws when the download fails", async () => {
		stubCvAndConsent(cvMetadata, true);
		server.use(
			http.get("/api/members/:id/cv/current/download", () =>
				HttpResponse.json({ error: "nope" }, { status: 404 }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberCv("user-1"));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await expect(result.current.fetchCvBlob()).rejects.toThrow(
			"Failed to download CV",
		);
	});
});
