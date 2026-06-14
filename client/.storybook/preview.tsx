import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { Preview } from "@storybook/react-vite";
import getAppTheme, { getPreferredColorMode } from "../src/theme";
// Tailwind v4 + shadcn tokens + Manrope font. Required so migrated shadcn
// components render with their styles inside Storybook.
import "../src/index.css";

const theme = getAppTheme(getPreferredColorMode());

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
	// Wrap every story in the existing MUI theme so MUI-based components keep
	// rendering correctly while the app migrates to shadcn/ui.
	decorators: [
		(Story) => (
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<Story />
			</ThemeProvider>
		),
	],
};

export default preview;
