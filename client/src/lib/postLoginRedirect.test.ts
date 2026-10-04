import { afterEach, describe, expect, it, vi } from "vitest";
import {
	consumePostLoginPath,
	isWelcomeSkipped,
	markWelcomeSkipped,
	rememberPostLoginPath,
} from "./postLoginRedirect";

describe("postLoginRedirect", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		window.sessionStorage.clear();
	});

	it("returns a remembered path once", () => {
		rememberPostLoginPath("/welcome?from=slack");

		expect(consumePostLoginPath()).toBe("/welcome?from=slack");
		expect(consumePostLoginPath()).toBeNull();
	});

	it.each([
		["the start page", "/"],
		["an absolute URL", "https://evil.example/welcome"],
		["a protocol-relative URL", "//evil.example/welcome"],
	])("ignores %s", (_label, path) => {
		rememberPostLoginPath(path);

		expect(consumePostLoginPath()).toBeNull();
	});

	it("ignores a tampered stored value", () => {
		window.sessionStorage.setItem(
			"member-manager:post-login-path",
			"//evil.example",
		);

		expect(consumePostLoginPath()).toBeNull();
	});

	it("remembers 'Later' for the session", () => {
		expect(isWelcomeSkipped()).toBe(false);
		markWelcomeSkipped();
		expect(isWelcomeSkipped()).toBe(true);
	});

	it("degrades to nothing remembered when storage throws", () => {
		// Private mode / blocked site data: every access throws.
		vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
			throw new Error("blocked");
		});

		expect(() => rememberPostLoginPath("/welcome")).not.toThrow();
		expect(() => markWelcomeSkipped()).not.toThrow();
		expect(consumePostLoginPath()).toBeNull();
		expect(isWelcomeSkipped()).toBe(false);
	});
});
