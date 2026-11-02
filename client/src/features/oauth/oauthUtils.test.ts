import { describe, expect, it } from "vitest";
import {
	describeRedirectTarget,
	describeScope,
	formatGrantedAt,
	isFollowableRedirect,
	parseScopes,
	readAuthorizationId,
} from "./oauthUtils";

describe("describeRedirectTarget", () => {
	it.each([
		"https://claude.ai/api/mcp/auth_callback",
		"https://claude.com/api/mcp/auth_callback",
		"https://chatgpt.com/connector_platform_oauth_redirect",
		"https://platform.openai.com/callback",
	])("knows the AI app at %s", (uri) => {
		expect(describeRedirectTarget(uri).isKnownApp).toBe(true);
	});

	it("treats this computer as known, for desktop and CLI agents", () => {
		expect(describeRedirectTarget("http://localhost:33418/callback")).toEqual({
			label: "localhost:33418",
			isKnownApp: true,
		});
		expect(
			describeRedirectTarget("http://127.0.0.1:6274/oauth/callback").isKnownApp,
		).toBe(true);
		expect(describeRedirectTarget("http://[::1]:8080/cb").isKnownApp).toBe(
			true,
		);
	});

	it("warns about look-alike and unknown hosts", () => {
		expect(describeRedirectTarget("https://claude.ai.evil.example/cb")).toEqual(
			{ label: "claude.ai.evil.example", isKnownApp: false },
		);
		expect(describeRedirectTarget("https://notclaude.ai/cb").isKnownApp).toBe(
			false,
		);
		expect(describeRedirectTarget("https://example.com/cb").isKnownApp).toBe(
			false,
		);
	});

	it("only knows AI app sites over https", () => {
		expect(describeRedirectTarget("http://claude.ai/cb").isKnownApp).toBe(
			false,
		);
	});

	it("shows the scheme for app links and the raw value it can't parse", () => {
		expect(
			describeRedirectTarget("cursor://anysphere.cursor-mcp/oauth/callback"),
		).toEqual({ label: "cursor://anysphere.cursor-mcp", isKnownApp: false });
		expect(describeRedirectTarget("not a url")).toEqual({
			label: "not a url",
			isKnownApp: false,
		});
	});
});

describe("isFollowableRedirect", () => {
	it("follows web and app links", () => {
		expect(isFollowableRedirect("https://claude.ai/cb?code=1")).toBe(true);
		expect(isFollowableRedirect("http://localhost:3000/cb?code=1")).toBe(true);
		expect(isFollowableRedirect("cursor://anysphere.cursor-mcp/cb")).toBe(true);
	});

	it("refuses script, data and file URLs, and garbage", () => {
		for (const url of [
			"javascript:alert(1)",
			"JavaScript:alert(1)",
			"data:text/html,hi",
			"vbscript:msgbox",
			"file:///etc/passwd",
			"blob:https://claude.ai/123",
			"no scheme",
		]) {
			expect(isFollowableRedirect(url), url).toBe(false);
		}
	});
});

describe("readAuthorizationId", () => {
	it("reads and trims the id", () => {
		expect(readAuthorizationId("?authorization_id=%20abc123%20")).toBe(
			"abc123",
		);
	});

	it("returns null when it is missing or blank", () => {
		expect(readAuthorizationId("")).toBeNull();
		expect(readAuthorizationId("?authorization_id=")).toBeNull();
		expect(readAuthorizationId("?other=1")).toBeNull();
	});
});

describe("scopes", () => {
	it("splits, drops blanks and de-duplicates", () => {
		expect(parseScopes(" openid  email openid ")).toEqual(["openid", "email"]);
		expect(parseScopes("")).toEqual([]);
		expect(parseScopes(undefined)).toEqual([]);
	});

	it("describes known scopes and shows unknown ones as they are", () => {
		expect(describeScope("email")).toBe("See your email address");
		expect(describeScope("notion:write")).toBe("notion:write");
	});
});

describe("formatGrantedAt", () => {
	it("formats a timestamp as a date", () => {
		expect(formatGrantedAt("2026-11-02T18:32:57.541472Z")).toBe("2 Nov 2026");
	});

	it("keeps a value it can't parse", () => {
		expect(formatGrantedAt("soon")).toBe("soon");
	});
});
