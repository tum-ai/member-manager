import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useAdminMcpAccess } from "./useAdminMcpAccess";

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

const pending = mcpAccessEntry({ user_id: "u-pending", name: "Pat Pending" });
const approved = mcpAccessEntry({
	user_id: "u-approved",
	name: "Abe Approved",
	status: "approved",
	role: "editor",
});
const denied = mcpAccessEntry({
	user_id: "u-denied",
	name: "Dee Denied",
	status: "denied",
});

function serveAccess() {
	const patches: Array<{ userId: string; body: unknown }> = [];
	server.use(
		http.get("/api/admin/mcp-access", () =>
			HttpResponse.json([denied, approved, pending]),
		),
		http.patch("/api/admin/mcp-access/:userId", async ({ params, request }) => {
			const body = await request.json();
			patches.push({ userId: String(params.userId), body });
			return HttpResponse.json(pending);
		}),
	);
	return patches;
}

beforeEach(() => {
	showToast.mockReset();
});

describe("useAdminMcpAccess", () => {
	it("groups the requests by status", async () => {
		serveAccess();
		const { result } = renderHookWithClient(() => useAdminMcpAccess());

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.pending).toEqual([pending]);
		expect(result.current.approved).toEqual([approved]);
		expect(result.current.denied).toEqual([denied]);
	});

	it("approves and changes roles right away", async () => {
		const patches = serveAccess();
		const { result } = renderHookWithClient(() => useAdminMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.approve(pending, "reader"));
		await waitFor(() => expect(patches).toHaveLength(1));
		act(() => result.current.setRole(approved, "reader"));
		await waitFor(() => expect(patches).toHaveLength(2));

		expect(patches).toEqual([
			{ userId: "u-pending", body: { action: "approve", role: "reader" } },
			{ userId: "u-approved", body: { action: "set_role", role: "reader" } },
		]);
		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Abe Approved is now a reader.",
				"success",
			),
		);
		expect(showToast).toHaveBeenCalledWith(
			"Pat Pending can now use the Notion MCP as reader.",
			"success",
		);
	});

	it("denies and revokes only after confirmation, with the note", async () => {
		const patches = serveAccess();
		const { result } = renderHookWithClient(() => useAdminMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.requestDeny(pending));
		expect(result.current.confirmation).toEqual({
			entry: pending,
			action: "deny",
		});
		expect(patches).toHaveLength(0);
		act(() => result.current.confirm("Not a member of a project yet"));
		expect(result.current.confirmation).toBeNull();

		act(() => result.current.requestRevoke(approved));
		act(() => result.current.confirm(""));

		await waitFor(() => expect(patches).toHaveLength(2));
		expect(patches).toEqual([
			{
				userId: "u-pending",
				body: { action: "deny", note: "Not a member of a project yet" },
			},
			{ userId: "u-approved", body: { action: "revoke", note: "" } },
		]);
	});

	it("cancelling a confirmation changes nothing", async () => {
		const patches = serveAccess();
		const { result } = renderHookWithClient(() => useAdminMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.requestRevoke(approved));
		act(() => result.current.cancelConfirmation());
		act(() => result.current.confirm("ignored"));

		expect(result.current.confirmation).toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(patches).toHaveLength(0);
	});

	it("says why a decision failed and reloads", async () => {
		let loads = 0;
		server.use(
			http.get("/api/admin/mcp-access", () => {
				loads += 1;
				return HttpResponse.json([pending]);
			}),
			http.patch("/api/admin/mcp-access/:userId", () =>
				HttpResponse.json(
					{ error: "Can't approve nomcp access that is approved" },
					{ status: 409 },
				),
			),
		);
		const { result } = renderHookWithClient(() => useAdminMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.approve(pending, "editor"));

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Couldn't update Notion MCP access: Can't approve nomcp access that is approved",
				"error",
			),
		);
		await waitFor(() => expect(loads).toBe(2));
	});

	it("marks the member whose decision is being saved", async () => {
		server.use(
			http.get("/api/admin/mcp-access", () => HttpResponse.json([pending])),
			http.patch("/api/admin/mcp-access/:userId", () => new Promise(() => {})),
		);
		const { result } = renderHookWithClient(() => useAdminMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.approve(pending, "editor"));

		await waitFor(() => expect(result.current.busyUserId).toBe("u-pending"));
	});

	it("reports a list that can't be loaded", async () => {
		server.use(
			http.get("/api/admin/mcp-access", () =>
				HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
			),
		);
		const { result } = renderHookWithClient(() => useAdminMcpAccess());

		await waitFor(() =>
			expect(result.current.error?.message).toBe("Forbidden"),
		);
	});
});
