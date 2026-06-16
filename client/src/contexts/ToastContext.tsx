import type React from "react";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";

type ToastSeverity = "success" | "error" | "info" | "warning";

interface ToastContextType {
	showToast: (message: string, severity?: ToastSeverity) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Thin wrapper over sonner so the 18 existing `useToast()` call sites keep the
// same `showToast(message, severity)` API. The <Toaster/> itself is mounted once
// in main.tsx.
export function ToastProvider({ children }: { children: React.ReactNode }) {
	const showToast = useCallback(
		(message: string, severity: ToastSeverity = "info") => {
			switch (severity) {
				case "success":
					toast.success(message);
					break;
				case "error":
					toast.error(message);
					break;
				case "warning":
					toast.warning(message);
					break;
				default:
					toast.info(message);
			}
		},
		[],
	);

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
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
