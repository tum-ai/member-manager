import { CssBaseline, ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import Auth from "./Auth";

vi.mock("../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			signInWithOAuth: vi.fn(),
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
});
