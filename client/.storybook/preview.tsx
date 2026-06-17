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
			// Global default is 'error': the a11y addon runs on every story and
			// FAILS the storybook-test CI job on any violation. A handful of stories
			// narrow this with a documented per-story override that disables a single
			// rule (e.g. a third-party chart that trips a false positive); see
			// JobCard and OrgChartDiagram. New stories must be a11y-clean by default.
			test: "error",
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
