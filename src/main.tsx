import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./theme-augmentation"; // Import type definitions
import CssBaseline from "@mui/material/CssBaseline"; // Optional: for consistent baseline styles
import { ThemeProvider } from "@mui/material/styles";
import getAppTheme from "./theme"; // Import the theme function

const darkTheme = getAppTheme(); // Directly create the dark theme once

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
					<CssBaseline />{" "}
					{/* Optional: Resets CSS for consistent base styles */}
					<App />
				</ThemeProvider>
			</React.StrictMode>,
		);
		console.log("App mounted successfully.");
	}
} catch (error) {
	console.error("Error mounting app:", error);
}
