import { CssBaseline, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import Auth from "./Auth";

const signInWithOAuthMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			signInWithOAuth: signInWithOAuthMock,
			signInWithPassword: signInWithPasswordMock,
		},
	},
}));

function renderAuth(colorMode: "light" | "dark") {
	return render(
		<ThemeProvider theme={getAppTheme(colorMode)}>
			<CssBaseline />
			<Auth colorMode={colorMode} onToggleColorMode={vi.fn()} />
		</ThemeProvider>,
	);
}

describe("Auth", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		signInWithOAuthMock.mockReset();
		signInWithPasswordMock.mockReset();
	});

	it("renders the white logo on a dark branded surface in light mode", () => {
		renderAuth("light");

		expect(screen.getByAltText("TUM.ai Logo")).toHaveAttribute(
			"src",
			"/img/tum_ai_logo_new.svg",
		);
		expect(screen.getByTestId("auth-logo-surface")).toHaveStyle({
			background:
				"linear-gradient(135deg, rgba(27, 0, 73, 0.98) 0%, rgba(82, 53, 115, 0.98) 100%)",
		});
	});

	it("keeps the white logo in dark mode", () => {
		renderAuth("dark");

		expect(screen.getByAltText("TUM.ai Logo")).toHaveAttribute(
			"src",
			"/img/tum_ai_logo_new.svg",
		);
	});

	it("offers a local admin login for the local Supabase stack", async () => {
		vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
		signInWithPasswordMock.mockResolvedValue({ error: null });

		renderAuth("light");

		fireEvent.click(screen.getByRole("button", { name: /local admin/i }));

		await waitFor(() => {
			expect(signInWithPasswordMock).toHaveBeenCalledWith({
				email: "admin@example.com",
				password: "password123",
			});
		});
	});
});
