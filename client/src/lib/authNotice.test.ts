import { afterEach, describe, expect, it } from "vitest";
import {
	consumeAuthNotice,
	describeOAuthError,
	initialAuthNotice,
	peekAuthNotice,
	readOAuthErrorDescription,
	rememberAuthNotice,
	SIGNUP_REJECTED_NOTICE,
	stripOAuthErrorParams,
	takeAuthNotice,
} from "./authNotice";

const REJECTED_SIGNUP =
	"error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user";

describe("authNotice", () => {
	afterEach(() => {
		window.sessionStorage.clear();
		window.history.replaceState(null, "", "/");
	});

	it("reads the OAuth error from the query string or the hash", () => {
		expect(
			readOAuthErrorDescription(`https://app.example/?${REJECTED_SIGNUP}`),
		).toBe("Database error saving new user");
		expect(
			readOAuthErrorDescription(`https://app.example/#${REJECTED_SIGNUP}`),
		).toBe("Database error saving new user");
		expect(readOAuthErrorDescription("https://app.example/")).toBeNull();
		expect(readOAuthErrorDescription("not a url")).toBeNull();
	});

	it("names the workspace as the likely cause of a rejected sign-up without claiming it", () => {
		expect(describeOAuthError("Database error saving new user")).toBe(
			SIGNUP_REJECTED_NOTICE,
		);
		expect(SIGNUP_REJECTED_NOTICE).toMatch(/couldn't create your account/i);
		expect(describeOAuthError("access_denied")).toBe(
			"Slack sign-in failed: access_denied",
		);
	});

	it("hands out a remembered notice only once", () => {
		rememberAuthNotice("Signed out");
		expect(peekAuthNotice()).toBe("Signed out");
		expect(takeAuthNotice()).toBe("Signed out");
		expect(takeAuthNotice()).toBeNull();
	});

	it("strips only the OAuth error parameters", () => {
		expect(
			stripOAuthErrorParams(
				`https://app.example/profile?tab=a&${REJECTED_SIGNUP}`,
			),
		).toBe("/profile?tab=a");
		expect(
			stripOAuthErrorParams(`https://app.example/#${REJECTED_SIGNUP}&keep=1`),
		).toBe("/#keep=1");
		expect(stripOAuthErrorParams("https://app.example/?tab=a")).toBeNull();
		expect(stripOAuthErrorParams("not a url")).toBeNull();
	});

	it("reads the notice without side effects, then consumes it", () => {
		rememberAuthNotice("Remembered");
		const url = `${window.location.origin}/?${REJECTED_SIGNUP}`;
		window.history.replaceState(null, "", url);

		// Pure: calling it twice (StrictMode) gives the same answer.
		expect(initialAuthNotice(url)).toBe(SIGNUP_REJECTED_NOTICE);
		expect(initialAuthNotice(url)).toBe(SIGNUP_REJECTED_NOTICE);

		consumeAuthNotice(url);
		expect(window.location.search).toBe("");
		expect(peekAuthNotice()).toBeNull();
		expect(initialAuthNotice()).toBe("");
	});

	it("falls back to the remembered notice", () => {
		rememberAuthNotice("Remembered");
		expect(initialAuthNotice("https://app.example/")).toBe("Remembered");
	});
});
