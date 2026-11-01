import { afterEach, describe, expect, it } from "vitest";
import {
	describeOAuthError,
	initialAuthNotice,
	readOAuthErrorDescription,
	rememberAuthNotice,
	takeAuthNotice,
	WORKSPACE_NOT_ALLOWED_NOTICE,
} from "./authNotice";

const REJECTED_SIGNUP =
	"error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user";

describe("authNotice", () => {
	afterEach(() => {
		window.sessionStorage.clear();
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

	it("explains a rejected sign-up as a workspace problem", () => {
		expect(describeOAuthError("Database error saving new user")).toBe(
			WORKSPACE_NOT_ALLOWED_NOTICE,
		);
		expect(describeOAuthError("access_denied")).toBe(
			"Slack sign-in failed: access_denied",
		);
	});

	it("hands out a remembered notice only once", () => {
		rememberAuthNotice("Signed out");
		expect(takeAuthNotice()).toBe("Signed out");
		expect(takeAuthNotice()).toBeNull();
	});

	it("prefers the redirect error and clears a remembered notice", () => {
		rememberAuthNotice("Remembered");
		expect(initialAuthNotice(`https://app.example/?${REJECTED_SIGNUP}`)).toBe(
			WORKSPACE_NOT_ALLOWED_NOTICE,
		);
		expect(takeAuthNotice()).toBeNull();

		rememberAuthNotice("Remembered");
		expect(initialAuthNotice("https://app.example/")).toBe("Remembered");
		expect(initialAuthNotice("https://app.example/")).toBe("");
	});
});
