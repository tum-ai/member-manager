import { useEffect } from "react";

/**
 * Asks the browser to confirm before the tab is reloaded or closed while
 * `isDirty` is true. In-app navigation is not covered: the app uses
 * `BrowserRouter`, which has no navigation blocker.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
	useEffect(() => {
		if (!isDirty) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
			event.preventDefault();
			// Some browsers still require a return value to show the prompt.
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [isDirty]);
}
