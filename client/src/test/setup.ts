import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mswServer";

// --- MSW: intercept `/api/*` requests in every test ---
// `onUnhandledRequest: "error"` surfaces any request the suite forgot to mock,
// so a hook hitting an unstubbed endpoint fails loudly instead of leaking to the
// network. Tests register per-case handlers with `server.use(...)`; they're
// cleared after each test. Files that stub `fetch` directly (e.g.
// apiClient.test.ts) still work — that stub shadows MSW for that test.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- jsdom polyfills for Radix UI primitives (shadcn/ui) ---
// jsdom doesn't implement these, and Radix's Select/Dialog/Dropdown/Tooltip and
// the sidebar's responsive logic rely on them. Without these, interaction tests
// throw "x is not a function" / "ResizeObserver is not defined".

if (!window.matchMedia) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as unknown as MediaQueryList;
}

if (!("ResizeObserver" in globalThis)) {
	globalThis.ResizeObserver = class {
		// Mirror the real ResizeObserver(callback) signature so callers passing a
		// callback aren't flagged as supplying a superfluous constructor argument.
		callback: ResizeObserverCallback;
		constructor(callback: ResizeObserverCallback) {
			this.callback = callback;
		}
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

if (!Element.prototype.hasPointerCapture) {
	Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
	Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
	Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = () => {};
}
