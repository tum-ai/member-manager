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
	it("uses the purple logo in light mode", () => {
		renderAuth("light");

		expect(screen.getByAltText("TUM.ai Logo")).toHaveAttribute(
			"src",
			"/img/logo_purple.svg",
		);
	});

	it("uses the white logo in dark mode", () => {
		renderAuth("dark");

		expect(screen.getByAltText("TUM.ai Logo")).toHaveAttribute(
			"src",
			"/img/tum_ai_logo_new.svg",
		);
	});
});
