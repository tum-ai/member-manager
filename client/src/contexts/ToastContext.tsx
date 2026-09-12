import type React from "react";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";

type ToastSeverity = "success" | "error" | "info" | "warning";

// An optional button on the toast. Used for actions that are cheap to reverse
// and easy to trigger by accident — parking a Planposten, say — where the undo
// belongs next to the confirmation rather than somewhere on the page.
interface ToastOptions {
	action?: { label: string; onClick: () => void };
}

interface ToastContextType {
	showToast: (
		message: string,
		severity?: ToastSeverity,
		options?: ToastOptions,
	) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Thin wrapper over sonner so the 18 existing `useToast()` call sites keep the
// same `showToast(message, severity)` API. The <Toaster/> itself is mounted once
// in main.tsx.
export function ToastProvider({ children }: { children: React.ReactNode }) {
	const showToast = useCallback(
		(
			message: string,
			severity: ToastSeverity = "info",
			options?: ToastOptions,
		) => {
			const config = options?.action ? { action: options.action } : undefined;
			switch (severity) {
				case "success":
					toast.success(message, config);
					break;
				case "error":
					toast.error(message, config);
					break;
				case "warning":
					toast.warning(message, config);
					break;
				default:
					toast.info(message, config);
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
