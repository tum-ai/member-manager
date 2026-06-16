import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
// Tailwind v4 + shadcn tokens + Manrope font. Required so shadcn components
// render with their styles inside Storybook.
import "../src/index.css";

function ThemeWrapper({
	mode,
	children,
}: {
	mode: "light" | "dark";
	children: ReactNode;
}) {
	// Drive the shadcn `.dark` token set from the toolbar, and paint the canvas
	// with the shadcn surface tokens (Storybook's canvas is white by default, so
	// without this the `.dark` near-white foreground would render white-on-white).
	useEffect(() => {
		document.documentElement.classList.toggle("dark", mode === "dark");
		document.body.style.backgroundColor = "var(--background)";
		document.body.style.color = "var(--foreground)";
	}, [mode]);

	return <div className="bg-background text-foreground">{children}</div>;
}

const withTheme: Decorator = (Story, context) => {
	const mode = context.globals.theme === "dark" ? "dark" : "light";
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
			// 'todo' - run a11y checks and surface violations, without failing
			// 'error' - run a11y checks and FAIL the test on any violation
			// 'off' - skip a11y checks entirely
			//
			// Global default is 'todo': the a11y addon runs on every story and
			// reports violations in the test output, but does not gate CI yet.
			// ~16 of the 50 pre-existing display stories (checkbox/switch
			// aria-checked, progress aria-progressbar-name, command/select/org-chart
			// button-name) have real violations that must be fixed at the component
			// level before global enforcement. Tracked as a follow-up. Stories that
			// are already clean opt in to enforcement via a per-story/meta override,
			// e.g. `parameters: { a11y: { test: "error" } }` (see Button, Modal).
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
	initialGlobals: { theme: "light" },
	decorators: [withTheme],
};

export default preview;
