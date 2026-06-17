import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileNavigation } from "./useProfileNavigation";

const SECTION_IDS = ["personal", "tumai", "links", "cv", "banking", "requests"];

function mountSections(): void {
	for (const id of SECTION_IDS) {
		const element = document.createElement("section");
		element.id = id;
		document.body.appendChild(element);
	}
}

function setSectionTop(id: string, top: number): void {
	const element = document.getElementById(id);
	if (!element) return;
	element.getBoundingClientRect = () => ({ top }) as unknown as DOMRect;
}

beforeEach(() => {
	mountSections();
	for (const id of SECTION_IDS) setSectionTop(id, 9999);
	Object.defineProperty(window, "innerHeight", {
		value: 800,
		configurable: true,
	});
	Object.defineProperty(document.documentElement, "scrollHeight", {
		value: 2000,
		configurable: true,
	});
	window.scrollY = 0;
});

afterEach(() => {
	document.body.innerHTML = "";
});

describe("useProfileNavigation", () => {
	it("includes the request-changes nav item only for non-admins", () => {
		const { result: member } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);
		expect(member.current.navItems.map((item) => item.id)).toContain(
			"requests",
		);

		const { result: admin } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: true }),
		);
		expect(admin.current.navItems.map((item) => item.id)).not.toContain(
			"requests",
		);
	});

	it("does not subscribe to scroll while loading", () => {
		const addSpy = vi.spyOn(window, "addEventListener");
		renderHook(() => useProfileNavigation({ isLoading: true, isAdmin: false }));
		expect(addSpy).not.toHaveBeenCalledWith(
			"scroll",
			expect.any(Function),
			expect.anything(),
		);
		addSpy.mockRestore();
	});

	it("activates the last section whose top crossed the trigger line", async () => {
		// personal + tumai are above the trigger line, links and below are not.
		setSectionTop("personal", -100);
		setSectionTop("tumai", 50);
		setSectionTop("links", 700);

		const { result } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);

		await waitFor(() => expect(result.current.activeSection).toBe("tumai"));
	});

	it("recomputes the active section on scroll", async () => {
		setSectionTop("personal", -100);
		const { result } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);
		await waitFor(() => expect(result.current.activeSection).toBe("personal"));

		// Now bring "links" above the line and fire a scroll event.
		setSectionTop("links", -10);
		const rafSpy = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((cb: FrameRequestCallback) => {
				cb(0);
				return 1;
			});

		act(() => {
			window.dispatchEvent(new Event("scroll"));
		});

		await waitFor(() => expect(result.current.activeSection).toBe("links"));
		rafSpy.mockRestore();
	});

	it("handles the bottom-of-page trigger line when scroll is exhausted", async () => {
		window.scrollY = 1200; // remaining == maxScroll (1200) -> ratio clamps to 1
		setSectionTop("personal", -50);
		const { result } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);
		await waitFor(() => expect(result.current.activeSection).toBe("personal"));
	});

	it("treats a non-scrollable page as fully scrolled (ratio 1)", async () => {
		Object.defineProperty(document.documentElement, "scrollHeight", {
			value: 800,
			configurable: true,
		});
		setSectionTop("personal", -50);
		const { result } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);
		await waitFor(() => expect(result.current.activeSection).toBe("personal"));
	});

	it("smooth-scrolls to the target section and prevents default on nav click", () => {
		const target = document.getElementById("cv");
		const scrollIntoView = vi.fn();
		if (target) target.scrollIntoView = scrollIntoView;

		const { result } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);

		const preventDefault = vi.fn();
		act(() => {
			result.current.handleNavClick(
				{ preventDefault } as unknown as React.MouseEvent<HTMLAnchorElement>,
				"cv",
			);
		});

		expect(preventDefault).toHaveBeenCalled();
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "start",
		});
	});

	it("removes its scroll and resize listeners on unmount", () => {
		const removeSpy = vi.spyOn(window, "removeEventListener");
		const { unmount } = renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);
		unmount();
		expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
		removeSpy.mockRestore();
	});

	it("coalesces rapid scroll events behind a single animation frame", () => {
		const rafSpy = vi
			.spyOn(window, "requestAnimationFrame")
			.mockReturnValue(123);
		renderHook(() =>
			useProfileNavigation({ isLoading: false, isAdmin: false }),
		);

		act(() => {
			window.dispatchEvent(new Event("scroll"));
			window.dispatchEvent(new Event("scroll"));
		});

		// Second scroll is dropped because a frame is already pending.
		expect(rafSpy).toHaveBeenCalledTimes(1);
		rafSpy.mockRestore();
	});
});
