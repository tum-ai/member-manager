import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useIsAdmin } from "./useIsAdmin";

const maybeSingle = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					maybeSingle,
				})),
			})),
		})),
	},
}));

describe("useIsAdmin", () => {
	beforeEach(() => {
		maybeSingle.mockReset();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("stays idle and not loading when no userId is provided", () => {
		const { result } = renderHookWithClient(() => useIsAdmin(undefined));
		expect(result.current.isAdmin).toBe(false);
		expect(result.current.isLoading).toBe(false);
	});

	it("reports admin when the role row is admin (remote project)", async () => {
		maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isAdmin).toBe(true);
	});

	it("reports non-admin when the role is something else", async () => {
		maybeSingle.mockResolvedValue({ data: { role: "user" }, error: null });

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isAdmin).toBe(false);
	});

	it("treats a missing role row as non-admin", async () => {
		maybeSingle.mockResolvedValue({ data: null, error: null });

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isAdmin).toBe(false);
	});

	it("logs and returns non-admin when the role read errors", async () => {
		maybeSingle.mockResolvedValue({
			data: null,
			error: new Error("rls denied"),
		});

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isAdmin).toBe(false);
		expect(console.error).toHaveBeenCalledWith(
			"Failed to fetch user role:",
			expect.any(Error),
		);
	});

	it("bootstraps the local admin role on a local Supabase project", async () => {
		vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
		maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
		let bootstrapped = false;
		server.use(
			http.post("/api/members/bootstrap-local-admin", () => {
				bootstrapped = true;
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isAdmin).toBe(true));
		expect(bootstrapped).toBe(true);
	});

	it("ignores an allowlist bootstrap failure and falls back to a role read", async () => {
		vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
		maybeSingle.mockResolvedValue({ data: { role: "user" }, error: null });
		server.use(
			http.post("/api/members/bootstrap-local-admin", () =>
				HttpResponse.json(
					{ error: "User is not in the local admin allowlist" },
					{ status: 403 },
				),
			),
		);

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isAdmin).toBe(false);
		expect(console.error).not.toHaveBeenCalled();
	});

	it("logs unexpected bootstrap failures but still reads the role", async () => {
		vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
		maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
		server.use(
			http.post("/api/members/bootstrap-local-admin", () =>
				HttpResponse.json({ error: "internal" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useIsAdmin("user-1"));

		await waitFor(() => expect(result.current.isAdmin).toBe(true));
		expect(console.error).toHaveBeenCalledWith(
			"Failed to bootstrap local admin role:",
			expect.any(Error),
		);
	});
});
