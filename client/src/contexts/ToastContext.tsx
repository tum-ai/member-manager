import { Alert, Snackbar } from "@mui/material";
import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

type ToastSeverity = "success" | "error" | "info" | "warning";

interface ToastContextType {
	showToast: (message: string, severity?: ToastSeverity) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [severity, setSeverity] = useState<ToastSeverity>("info");

	const showToast = useCallback((msg: string, sev: ToastSeverity = "info") => {
		setMessage(msg);
		setSeverity(sev);
		setOpen(true);
	}, []);

	const handleClose = (
		_event?: React.SyntheticEvent | Event,
		reason?: string,
	) => {
		if (reason === "clickaway") {
			return;
		}
		setOpen(false);
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<Snackbar
				open={open}
				autoHideDuration={6000}
				onClose={handleClose}
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
			>
				<Alert onClose={handleClose} severity={severity} sx={{ width: "100%" }}>
					{message}
				</Alert>
			</Snackbar>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (context === undefined) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}
