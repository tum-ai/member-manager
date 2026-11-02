import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import OAuthConsentPage from "./OAuthConsentPage";

const { oauth } = vi.hoisted(() => ({
	oauth: {
		getAuthorizationDetails: vi.fn(),
		approveAuthorization: vi.fn(),
		denyAuthorization: vi.fn(),
	},
}));

vi.mock("@/lib/supabaseClient", () => ({
	supabase: { auth: { oauth, signOut: vi.fn() } },
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
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("explains what the app gets before asking", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude.ai/api/mcp/auth_callback"),
		);
		renderPage();

		expect(
			await screen.findByRole("heading", {
				name: "Allow Claude to use your TUM.ai account?",
			}),
		).toBeInTheDocument();
		expect(screen.getByText(/signed in as ada@example\.com/i)).toBeVisible();
		expect(
			screen.getByText(
				/read and edit the TUM\.ai Notion workspace as you through the TUM\.ai Notion MCP \(nomcp\)/,
			),
		).toBeVisible();
		expect(
			screen.getByText(/every action is logged under your name/i),
		).toBeVisible();
		expect(screen.getByText("claude.ai")).toBeVisible();
		expect(screen.getByText("See your email address")).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Connected apps" }),
		).toHaveAttribute("href", "/connected-apps");
		expect(screen.queryByTestId("oauth-unknown-redirect")).toBeNull();
	});

	it("warns when the app sends you somewhere unknown", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue(
			details("https://claude-ai.example.net/callback"),
		);
		renderPage();

		expect(
			await screen.findByTestId("oauth-unknown-redirect"),
		).toHaveTextContent(
			/claude-ai\.example\.net isn't a site we know for AI apps/,
		);
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
