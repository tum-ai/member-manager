import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return "Unknown startup error";
}

function renderStartupError(message: string): void {
	const rootElement = document.getElementById("root");
	if (!rootElement) {
		console.error("Root element not found!");
		return;
	}

	ReactDOM.createRoot(rootElement).render(
		<React.StrictMode>
			<div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
				<h1 className="text-2xl font-bold">App failed to start</h1>
				<p className="text-muted-foreground">{message}</p>
				<p className="text-muted-foreground">
					Check client/.env.local or client/.env, then restart the Vite dev
					server.
				</p>
			</div>
		</React.StrictMode>,
	);
}

async function bootstrap(): Promise<void> {
	console.log("Starting app...");
	const rootElement = document.getElementById("root");

	if (!rootElement) {
		console.error("Root element not found!");
		return;
	}

	try {
		const { default: App } = await import("./App");
		const { ThemeProvider } = await import("next-themes");
		const { Toaster } = await import("./components/ui/sonner");

		console.log("Root element found, mounting...");
		ReactDOM.createRoot(rootElement).render(
			<React.StrictMode>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					storageKey="member-manager-color-mode"
				>
					<App />
					<Toaster />
				</ThemeProvider>
			</React.StrictMode>,
		);
		console.log("App mounted successfully.");
	} catch (error) {
		console.error("Error mounting app:", error);
		renderStartupError(getErrorMessage(error));
	}
}

void bootstrap();
