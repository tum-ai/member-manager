import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./theme-augmentation";
import { Box, Typography } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import getAppTheme from "./theme";

const darkTheme = getAppTheme();

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
			<ThemeProvider theme={darkTheme}>
				<CssBaseline />
				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						alignItems: "center",
						minHeight: "100vh",
						px: 3,
						textAlign: "center",
						gap: 2,
					}}
				>
					<Typography variant="h4">App failed to start</Typography>
					<Typography color="text.secondary">{message}</Typography>
					<Typography color="text.secondary">
						Check client/.env.local or client/.env, then restart the Vite dev
						server.
					</Typography>
				</Box>
			</ThemeProvider>
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

		console.log("Root element found, mounting...");
		ReactDOM.createRoot(rootElement).render(
			<React.StrictMode>
				<ThemeProvider theme={darkTheme}>
					<CssBaseline />
					<App />
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
