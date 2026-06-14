import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import getAppTheme, {
	type AppColorMode,
	getPreferredColorMode,
} from "../src/theme";
// Tailwind v4 + shadcn tokens + Manrope font. Required so migrated shadcn
// components render with their styles inside Storybook.
import "../src/index.css";

function ThemeWrapper({
	mode,
	children,
}: {
	mode: AppColorMode;
	children: ReactNode;
}) {
	// Keep the shadcn `.dark` token set in sync with the MUI color mode, mirroring
	// what App.tsx does in the real app.
	useEffect(() => {
		document.documentElement.classList.toggle("dark", mode === "dark");
	}, [mode]);

	return (
		<ThemeProvider theme={getAppTheme(mode)}>
			<CssBaseline />
			{children}
		</ThemeProvider>
	);
}

// Wrap every story in the MUI theme so MUI-based components keep rendering
// correctly while the app migrates to shadcn/ui. The toolbar switches both the
// MUI theme and the shadcn `.dark` tokens together.
const withTheme: Decorator = (Story, context) => {
	const mode: AppColorMode =
		context.globals.theme === "dark" ? "dark" : "light";
	return (
		<ThemeWrapper mode={mode}>
			<Story />
		</ThemeWrapper>
	);
};

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: "todo",
		},
	},
	globalTypes: {
		theme: {
			description: "Color mode",
			toolbar: {
				title: "Theme",
				icon: "circlehollow",
				items: [
					{ value: "light", title: "Light", icon: "sun" },
					{ value: "dark", title: "Dark", icon: "moon" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { theme: getPreferredColorMode() },
	decorators: [withTheme],
};

export default preview;
