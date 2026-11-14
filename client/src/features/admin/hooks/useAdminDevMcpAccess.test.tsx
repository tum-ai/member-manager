import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEV_MCP_CATALOG,
	devMcpAccessEntry,
} from "@/test/devMcpAccessFixtures";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useAdminDevMcpAccess } from "./useAdminDevMcpAccess";

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

const requested = devMcpAccessEntry({ user_id: "u-req", name: "Rey" });
const active = devMcpAccessEntry({
	user_id: "u-act",
	name: "Alma",
	status: "active",
	role: "lead",
	tools: ["whoami"],
});
const suspended = devMcpAccessEntry({
	user_id: "u-sus",
	name: "Sam",
	status: "suspended",
});

function serve() {
	const patches: Array<{ userId: string; body: unknown }> = [];
	const loads = { list: 0 };
	server.use(
		http.get("/api/admin/dev-mcp-access", () => {
			loads.list += 1;
			return HttpResponse.json([suspended, active, requested]);
		}),
		http.get("/api/admin/dev-mcp-access/catalog", () =>
			HttpResponse.json({ tools: DEV_MCP_CATALOG }),
		),
		http.patch(
			"/api/admin/dev-mcp-access/:userId",
			async ({ params, request }) => {
				patches.push({
					userId: String(params.userId),
					body: await request.json(),
				});
				return HttpResponse.json(active);
			},
		),
	);
	return { patches, loads };
}

beforeEach(() => {
	showToast.mockReset();
});

describe("useAdminDevMcpAccess", () => {
	it("groups access by status and loads the catalog", async () => {
		serve();
		const { result } = renderHookWithClient(() => useAdminDevMcpAccess());

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.requested).toEqual([requested]);
		expect(result.current.active).toEqual([active]);
		expect(result.current.suspended).toEqual([suspended]);
		await waitFor(() =>
			expect(result.current.catalog).toEqual(DEV_MCP_CATALOG),
		);
	});

	it("loads nothing while disabled", async () => {
		const { loads } = serve();
		const { result } = renderHookWithClient(() =>
			useAdminDevMcpAccess({ enabled: false }),
		);

		expect(result.current.isLoading).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(loads.list).toBe(0);
	});

	it("approves a request, and approves a suspended member again", async () => {
		const { patches } = serve();
		const { result } = renderHookWithClient(() => useAdminDevMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.approve(requested, "lead"));
		await waitFor(() => expect(patches).toHaveLength(1));
		act(() => result.current.approve(suspended, "member"));
		await waitFor(() => expect(patches).toHaveLength(2));
		act(() => result.current.setRole(active, "admin"));
		await waitFor(() => expect(patches).toHaveLength(3));

		expect(patches).toEqual([
			{ userId: "u-req", body: { action: "approve", role: "lead" } },
			{ userId: "u-sus", body: { action: "reapprove", role: "member" } },
			{ userId: "u-act", body: { action: "set_role", role: "admin" } },
		]);
		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Rey can now use Dev MCP as a lead.",
				"success",
			),
		);
	});

	it("suspends and denies only after confirmation", async () => {
		const { patches } = serve();
		const { result } = renderHookWithClient(() => useAdminDevMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.requestSuspend(active));
		expect(result.current.confirmation).toEqual({
			entry: active,
			action: "suspend",
		});
		expect(patches).toHaveLength(0);
		act(() => result.current.confirm("Left"));
		act(() => result.current.requestDeny(requested));
		act(() => result.current.cancelConfirmation());
		act(() => result.current.confirm("ignored"));

		await waitFor(() => expect(patches).toHaveLength(1));
		expect(patches).toEqual([
			{ userId: "u-act", body: { action: "suspend", note: "Left" } },
		]);
	});

	it("edits tools through the dialog state", async () => {
		const { patches } = serve();
		const { result } = renderHookWithClient(() => useAdminDevMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.editTools(active));
		expect(result.current.editingTools).toEqual(active);
		act(() => result.current.saveTools(["whoami", "create_mailbox"]));
		expect(result.current.editingTools).toBeNull();

		await waitFor(() =>
			expect(patches).toEqual([
				{
					userId: "u-act",
					body: { action: "set_tools", tools: ["whoami", "create_mailbox"] },
				},
			]),
		);
		act(() => result.current.editTools(active));
		act(() => result.current.cancelEditTools());
		act(() => result.current.saveTools([]));
		expect(patches).toHaveLength(1);
	});

	it("says why an action failed and reloads", async () => {
		const { loads } = serve();
		server.use(
			http.patch("/api/admin/dev-mcp-access/:userId", () =>
				HttpResponse.json(
					{ error: "This member is the last active Dev MCP admin" },
					{ status: 409 },
				),
			),
		);
		const { result } = renderHookWithClient(() => useAdminDevMcpAccess());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.setRole(active, "member"));

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Couldn't update Dev MCP access: This member is the last active Dev MCP admin",
				"error",
			),
		);
		await waitFor(() => expect(loads.list).toBe(2));
	});

	it("reports a catalog that can't be loaded", async () => {
		serve();
		server.use(
			http.get("/api/admin/dev-mcp-access/catalog", () =>
				HttpResponse.json(
					{ error: "Dev MCP isn't configured" },
					{ status: 503 },
				),
			),
		);
		const { result } = renderHookWithClient(() => useAdminDevMcpAccess());

		await waitFor(() =>
			expect(result.current.catalogError?.message).toBe(
				"Dev MCP isn't configured",
			),
		);
		expect(result.current.catalog).toEqual([]);
	});
});
