import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

function fireBeforeUnload(): BeforeUnloadEvent {
	const event = new Event("beforeunload", {
		cancelable: true,
	}) as BeforeUnloadEvent;
	window.dispatchEvent(event);
	return event;
}

describe("useUnsavedChangesWarning", () => {
	it("blocks unloading while there are unsaved changes", () => {
		renderHook(() => useUnsavedChangesWarning(true));

		expect(fireBeforeUnload().defaultPrevented).toBe(true);
	});

	it("lets the page unload when nothing is unsaved", () => {
		renderHook(() => useUnsavedChangesWarning(false));

		expect(fireBeforeUnload().defaultPrevented).toBe(false);
	});

	it("stops blocking once the changes are saved", () => {
		const { rerender } = renderHook(
			({ isDirty }) => useUnsavedChangesWarning(isDirty),
			{ initialProps: { isDirty: true } },
		);

		rerender({ isDirty: false });

		expect(fireBeforeUnload().defaultPrevented).toBe(false);
	});

	it("removes its listener on unmount", () => {
		const { unmount } = renderHook(() => useUnsavedChangesWarning(true));

		unmount();

		expect(fireBeforeUnload().defaultPrevented).toBe(false);
	});
});
