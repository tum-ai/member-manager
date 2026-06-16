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
	initialGlobals: { theme: "light" },
	decorators: [withTheme],
};

export default preview;
