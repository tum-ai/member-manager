import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import OAuthConsentPage from "./OAuthConsentPage";

const { oauth, rpc } = vi.hoisted(() => ({
	rpc: vi.fn(),
	oauth: {
		getAuthorizationDetails: vi.fn(),
		approveAuthorization: vi.fn(),
		denyAuthorization: vi.fn(),
	},
}));

vi.mock("@/lib/supabaseClient", () => ({
	supabase: { auth: { oauth, signOut: vi.fn() }, rpc },
}));

function details(redirectUri: string) {
	return {
		data: {
			authorization_id: "auth-1",
			redirect_uri: redirectUri,
			client: { id: "client-1", name: "Claude" },
			user: { id: "user-1", email: "ada@example.com" },
			scope: "email",
		},
		error: null,
	};
}

function renderPage(search = "?authorization_id=auth-1") {
	const redirect = vi.fn();
	renderWithClient(
		<MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
			<OAuthConsentPage redirect={redirect} />
		</MemoryRouter>,
	);
	return { redirect };
}

describe("OAuthConsentPage", () => {
	beforeEach(() => {
		rpc.mockResolvedValue({ data: null, error: null });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("binds the app to its server before approving", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude.ai/api/mcp/auth_callback"),
		);
		oauth.approveAuthorization.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?code=abc" },
			error: null,
		});
		const { redirect } = renderPage();

		await userEvent.click(
			await screen.findByRole("button", { name: "Approve" }),
		);

		await waitFor(() =>
			expect(redirect).toHaveBeenCalledWith("https://claude.ai/cb?code=abc"),
		);
		expect(rpc).toHaveBeenCalledWith("bind_oauth_authorization", {
			authorization_id: "auth-1",
		});
		expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
			oauth.approveAuthorization.mock.invocationCallOrder[0],
		);
	});

	it("doesn't approve an app bound to another TUM.ai server", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude.ai/api/mcp/auth_callback"),
		);
		rpc.mockResolvedValue({
			data: null,
			error: {
				message:
					"This app is already connected to another TUM.ai server. Add it again in your AI app for this one.",
			},
		});
		const { redirect } = renderPage();

		await userEvent.click(
			await screen.findByRole("button", { name: "Approve" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/already connected to another TUM\.ai server/,
		);
		expect(oauth.approveAuthorization).not.toHaveBeenCalled();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("doesn't follow an earlier approval that can't be bound", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?code=abc" },
			error: null,
		});
		rpc.mockResolvedValue({
			data: null,
			error: {
				message:
					"This app is already connected to another TUM.ai server. Add it again in your AI app for this one.",
			},
		});
		const { redirect } = renderPage();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/can't connect to this TUM\.ai server.*already connected to another TUM\.ai server/,
		);
		expect(redirect).not.toHaveBeenCalled();
	});

	it("explains what the app gets before asking", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude.ai/api/mcp/auth_callback"),
		);
		renderPage();

		expect(
			await screen.findByRole("heading", {
				name: "Allow this app to act as you on a TUM.ai MCP server?",
			}),
		).toBeInTheDocument();
		expect(screen.getByTestId("oauth-redirect-target")).toHaveTextContent(
			/^claude\.ai$/,
		);
		expect(screen.getByText("Approved TUM.ai MCP client")).toBeVisible();
		expect(screen.getByText(/calls itself “Claude”/)).toBeVisible();
		expect(screen.getByText(/signed in as ada@example\.com/i)).toBeVisible();
		expect(
			screen.getByText(
				/act as you on the TUM\.ai MCP server.*Notion MCP \(nomcp\).*Dev MCP.*every action is logged under your name/i,
			),
		).toBeVisible();
		expect(
			screen.getByText("Approve only if you just connected this app yourself."),
		).toBeVisible();
		expect(screen.getByText("See your email address")).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Connected apps" }),
		).toHaveAttribute("href", "/connected-apps");
		expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
	});

	it("only lets the member deny an app that isn't an approved MCP client", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: {
				...details("https://tumai-event-rsvp.example.com/callback").data,
				client: { id: "client-2", name: "TUM.ai Event RSVP" },
			},
			error: null,
		});
		oauth.denyAuthorization.mockResolvedValue({
			data: {
				redirect_url:
					"https://tumai-event-rsvp.example.com/callback?error=access_denied",
			},
			error: null,
		});
		const { redirect } = renderPage();

		expect(
			await screen.findByRole("heading", {
				name: "This app isn't an approved TUM.ai MCP client",
			}),
		).toBeInTheDocument();
		expect(screen.getByTestId("oauth-redirect-target")).toHaveTextContent(
			/^tumai-event-rsvp\.example\.com$/,
		);
		expect(screen.getByText("Not an approved MCP client")).toBeVisible();
		expect(screen.getByRole("alert")).toHaveTextContent(
			/ask the dev team to add it/,
		);
		expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
		expect(
			screen.queryByText(/act as you on the TUM\.ai MCP server/),
		).toBeNull();

		await userEvent.click(screen.getByRole("button", { name: "Deny" }));

		expect(
			await screen.findByText(/you denied access\. nothing was shared/i),
		).toBeVisible();
		expect(oauth.denyAuthorization).toHaveBeenCalledWith("auth-1", {
			skipBrowserRedirect: true,
		});
		expect(oauth.approveAuthorization).not.toHaveBeenCalled();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("explains why it didn't follow an earlier approval to an unapproved site", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://evil.example/callback?code=abc" },
			error: null,
		});
		const { redirect } = renderPage();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/isn't an approved TUM\.ai MCP client.*evil\.example.*nothing was shared/,
		);
		expect(redirect).not.toHaveBeenCalled();
	});

	it("disables both buttons while the decision is saved", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude.ai/api/mcp/auth_callback"),
		);
		oauth.approveAuthorization.mockReturnValue(new Promise(() => {}));
		renderPage();

		await userEvent.click(
			await screen.findByRole("button", { name: "Approve" }),
		);

		await waitFor(() =>
			expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled(),
		);
		expect(screen.getByRole("button", { name: "Deny" })).toBeDisabled();
	});

	it("shows why a decision failed", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude.ai/api/mcp/auth_callback"),
		);
		oauth.denyAuthorization.mockResolvedValue({
			data: null,
			error: new Error("authorization expired"),
		});
		renderPage();

		await userEvent.click(await screen.findByRole("button", { name: "Deny" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"authorization expired",
		);
		expect(screen.getByRole("button", { name: "Deny" })).toBeEnabled();
	});

	it("explains an incomplete link", () => {
		renderPage("");

		expect(screen.getByRole("alert")).toHaveTextContent(
			/this link is incomplete/i,
		);
	});

	it("explains a request that can't be used", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: null,
			error: new Error("authorization not found"),
		});
		renderPage();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/may have expired or been answered already.*details: authorization not found/i,
		);
	});

	it("shows progress while loading and while leaving", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?code=abc" },
			error: null,
		});
		const { redirect } = renderPage();

		expect(screen.getByText("Loading the request…")).toBeVisible();
		expect(
			await screen.findByText("Taking you back to the app…"),
		).toBeVisible();
		expect(redirect).toHaveBeenCalledWith("https://claude.ai/cb?code=abc");
	});
});
