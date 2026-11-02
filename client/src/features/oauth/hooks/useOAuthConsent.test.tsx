import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberPostLoginPath } from "@/lib/postLoginRedirect";
import { createTestQueryClient } from "@/test/renderWithClient";
import { useOAuthConsent } from "./useOAuthConsent";

const { oauth, signOut } = vi.hoisted(() => ({
	oauth: {
		getAuthorizationDetails: vi.fn(),
		approveAuthorization: vi.fn(),
		denyAuthorization: vi.fn(),
	},
	signOut: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
	supabase: { auth: { oauth, signOut } },
}));

const CONSENT_DETAILS = {
	authorization_id: "auth-1",
	redirect_uri: "https://claude.ai/api/mcp/auth_callback",
	client: { id: "client-1", name: "Claude" },
	user: { id: "user-1", email: "ada@example.com" },
	scope: "email",
};

function renderConsentHook(search = "?authorization_id=auth-1") {
	const redirect = vi.fn();
	const queryClient = createTestQueryClient();
	function Wrapper({ children }: PropsWithChildren) {
		return (
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
					{children}
				</MemoryRouter>
			</QueryClientProvider>
		);
	}
	const view = renderHook(() => useOAuthConsent({ redirect }), {
		wrapper: Wrapper,
	});
	return { ...view, redirect };
}

describe("useOAuthConsent", () => {
	afterEach(() => {
		vi.clearAllMocks();
		window.sessionStorage.clear();
	});

	it("reports a link without an authorization id", () => {
		const { result } = renderConsentHook("");

		expect(result.current.state).toEqual({ status: "missing-request" });
		expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
	});

	it("loads the request that needs consent", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: CONSENT_DETAILS,
			error: null,
		});
		const { result } = renderConsentHook();

		expect(result.current.state).toEqual({ status: "loading" });
		await waitFor(() => expect(result.current.state.status).toBe("consent"));
		expect(result.current.state).toMatchObject({
			request: { clientName: "Claude", scopes: ["email"] },
			redirectTarget: { label: "claude.ai", isKnownApp: true },
		});
		expect(oauth.getAuthorizationDetails).toHaveBeenCalledWith("auth-1");
	});

	it("sends a member who already approved the app straight back", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?code=abc" },
			error: null,
		});
		const { result, redirect } = renderConsentHook();

		await waitFor(() =>
			expect(redirect).toHaveBeenCalledWith("https://claude.ai/cb?code=abc"),
		);
		expect(result.current.state).toEqual({ status: "redirecting" });
	});

	it("refuses to follow a script URL", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "javascript:alert(1)" },
			error: null,
		});
		const { result, redirect } = renderConsentHook();

		await waitFor(() => expect(result.current.state.status).toBe("error"));
		expect(redirect).not.toHaveBeenCalled();
	});

	it("reports a request that can't be loaded", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: null,
			error: new Error("authorization not found"),
		});
		const { result } = renderConsentHook();

		await waitFor(() =>
			expect(result.current.state).toEqual({
				status: "error",
				message: "authorization not found",
			}),
		);
	});

	it("approves, then follows Supabase's redirect", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: CONSENT_DETAILS,
			error: null,
		});
		let finish: (value: unknown) => void = () => {};
		oauth.approveAuthorization.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		const { result, redirect } = renderConsentHook();
		await waitFor(() => expect(result.current.state.status).toBe("consent"));

		act(() => result.current.approve());

		await waitFor(() => expect(result.current.pendingDecision).toBe("approve"));
		expect(oauth.approveAuthorization).toHaveBeenCalledWith("auth-1", {
			skipBrowserRedirect: true,
		});
		act(() =>
			finish({
				data: { redirect_url: "https://claude.ai/cb?code=abc" },
				error: null,
			}),
		);
		await waitFor(() =>
			expect(redirect).toHaveBeenCalledWith("https://claude.ai/cb?code=abc"),
		);
		expect(result.current.state).toEqual({ status: "redirecting" });
	});

	it("denies, then follows Supabase's redirect", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: CONSENT_DETAILS,
			error: null,
		});
		oauth.denyAuthorization.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?error=access_denied" },
			error: null,
		});
		const { result, redirect } = renderConsentHook();
		await waitFor(() => expect(result.current.state.status).toBe("consent"));

		act(() => result.current.deny());

		await waitFor(() =>
			expect(redirect).toHaveBeenCalledWith(
				"https://claude.ai/cb?error=access_denied",
			),
		);
		expect(oauth.approveAuthorization).not.toHaveBeenCalled();
	});

	it("keeps the form and shows the error when a decision fails", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: CONSENT_DETAILS,
			error: null,
		});
		oauth.approveAuthorization.mockResolvedValue({
			data: null,
			error: new Error("authorization expired"),
		});
		const { result, redirect } = renderConsentHook();
		await waitFor(() => expect(result.current.state.status).toBe("consent"));

		act(() => result.current.approve());

		await waitFor(() =>
			expect(result.current.decisionError).toBe("authorization expired"),
		);
		expect(result.current.state.status).toBe("consent");
		expect(result.current.pendingDecision).toBeNull();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("forgets the URL remembered for after sign-in", () => {
		rememberPostLoginPath("/oauth/consent?authorization_id=auth-1");

		renderConsentHook("");

		expect(
			window.sessionStorage.getItem("member-manager:post-login-path"),
		).toBeNull();
	});

	it("signs out to switch accounts", () => {
		const { result } = renderConsentHook("");

		act(() => result.current.switchAccount());

		expect(signOut).toHaveBeenCalled();
	});
});
