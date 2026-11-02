import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useConnectedApps } from "./useConnectedApps";

const { oauth, showToast } = vi.hoisted(() => ({
	oauth: { listGrants: vi.fn(), revokeGrant: vi.fn() },
	showToast: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({ supabase: { auth: { oauth } } }));
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ showToast }) }));

const CLAUDE_GRANT = {
	client: { id: "client-1", name: "Claude" },
	scopes: ["email"],
	granted_at: "2026-11-02T18:32:57Z",
};

describe("useConnectedApps", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("lists the approved apps", async () => {
		oauth.listGrants.mockResolvedValue({ data: [CLAUDE_GRANT], error: null });
		const { result } = renderHookWithClient(() => useConnectedApps());

		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.apps).toEqual([
			{
				clientId: "client-1",
				name: "Claude",
				scopes: ["email"],
				grantedAt: "2026-11-02T18:32:57Z",
			},
		]);
		expect(result.current.hasError).toBe(false);
	});

	it("reports a list that can't be loaded", async () => {
		oauth.listGrants.mockResolvedValue({
			data: null,
			error: new Error("OAuth server is disabled"),
		});
		const { result } = renderHookWithClient(() => useConnectedApps());

		await waitFor(() => expect(result.current.hasError).toBe(true));
		expect(result.current.apps).toEqual([]);
	});

	it("revokes only after confirmation, then reloads the list", async () => {
		oauth.listGrants
			.mockResolvedValueOnce({ data: [CLAUDE_GRANT], error: null })
			.mockResolvedValue({ data: [], error: null });
		oauth.revokeGrant.mockResolvedValue({ data: {}, error: null });
		const { result } = renderHookWithClient(() => useConnectedApps());
		await waitFor(() => expect(result.current.apps).toHaveLength(1));

		act(() => result.current.requestRevoke(result.current.apps[0]));
		expect(result.current.appToRevoke?.clientId).toBe("client-1");
		expect(oauth.revokeGrant).not.toHaveBeenCalled();

		act(() => result.current.confirmRevoke());

		expect(result.current.appToRevoke).toBeNull();
		await waitFor(() => expect(result.current.apps).toEqual([]));
		expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: "client-1" });
		expect(showToast).toHaveBeenCalledWith(
			"Claude was disconnected.",
			"success",
		);
	});

	it("keeps the app and says so when revoking fails", async () => {
		oauth.listGrants.mockResolvedValue({ data: [CLAUDE_GRANT], error: null });
		oauth.revokeGrant.mockResolvedValue({
			data: null,
			error: new Error("network down"),
		});
		const { result } = renderHookWithClient(() => useConnectedApps());
		await waitFor(() => expect(result.current.apps).toHaveLength(1));

		act(() => result.current.requestRevoke(result.current.apps[0]));
		act(() => result.current.confirmRevoke());

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Couldn't disconnect Claude: network down",
				"error",
			),
		);
		expect(result.current.apps).toHaveLength(1);
		expect(result.current.revokingClientId).toBeNull();
	});

	it("cancelling forgets the app to revoke", async () => {
		oauth.listGrants.mockResolvedValue({ data: [CLAUDE_GRANT], error: null });
		const { result } = renderHookWithClient(() => useConnectedApps());
		await waitFor(() => expect(result.current.apps).toHaveLength(1));

		act(() => result.current.requestRevoke(result.current.apps[0]));
		act(() => result.current.cancelRevoke());

		expect(result.current.appToRevoke).toBeNull();
		act(() => result.current.confirmRevoke());
		expect(oauth.revokeGrant).not.toHaveBeenCalled();
	});
});
