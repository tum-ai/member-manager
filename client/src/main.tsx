import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./theme-augmentation";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import getAppTheme from "./theme";

const darkTheme = getAppTheme();

console.log("Starting app...");
try {
	const rootElement = document.getElementById("root");
	if (!rootElement) {
		console.error("Root element not found!");
	} else {
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
	}
} catch (error) {
	console.error("Error mounting app:", error);
}
