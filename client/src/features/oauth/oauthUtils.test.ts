import { describe, expect, it } from "vitest";
import {
	APPROVED_MCP_CLIENT_REDIRECTS,
	describeRedirectTarget,
	describeScope,
	formatGrantedAt,
	parseScopes,
	readAuthorizationId,
} from "./oauthUtils";

const isApproved = (uri: string) => describeRedirectTarget(uri).isApproved;

describe("approved MCP client redirects", () => {
	it.each([
		"https://claude.ai/api/mcp/auth_callback",
		"https://claude.com/api/mcp/auth_callback",
		"https://chatgpt.com/connector_platform_oauth_redirect",
		"https://platform.openai.com/callback",
		"https://CLAUDE.AI/api/mcp/auth_callback",
		"https://claude.ai:8443/cb",
	])("approves the AI app site %s", (uri) => {
		expect(isApproved(uri)).toBe(true);
	});

	it.each([
		"http://localhost:33418/callback",
		"http://localhost/callback",
		"https://localhost:3000/cb",
		"http://127.0.0.1:6274/oauth/callback",
		"http://[::1]:8080/cb",
	])("approves this computer at %s, for CLI clients", (uri) => {
		expect(isApproved(uri)).toBe(true);
	});

	it.each([
		"cursor://anysphere.cursor-mcp/oauth/callback",
		"vscode://vscode.github-authentication/did-authenticate",
		"vscode-insiders://vscode.github-authentication/did-authenticate",
		"windsurf://codeium.windsurf/oauth",
		"Cursor://anysphere.cursor-mcp/oauth/callback",
	])("approves the desktop app link %s", (uri) => {
		expect(isApproved(uri)).toBe(true);
	});

	it.each([
		// Any other site, whatever the app calls itself.
		"https://tumai-event-rsvp.example.com/callback",
		"https://example.com/cb",
		// Hosts that imitate approved domains.
		"https://claude.ai.evil.example/cb",
		"https://evilclaude.ai/cb",
		"https://chatgpt.com.evil.example/cb",
		"https://claude.ai./cb",
		// The real host is after the @.
		"https://claude.ai@evil.example/cb",
		// Approved domains only over https.
		"http://claude.ai/cb",
		"http://chatgpt.com/cb",
		// Hosts that imitate this computer.
		"http://localhost.evil.example/cb",
		"http://127.0.0.1.nip.io/cb",
		"http://0.0.0.0:3000/cb",
		// Other schemes.
		"evil://callback",
		"cursor-evil://callback",
		"javascript:alert(1)",
		"data:text/html,hi",
		"file:///etc/passwd",
		"ftp://claude.ai/cb",
		"not a url",
	])("blocks %s", (uri) => {
		expect(isApproved(uri)).toBe(false);
	});

	it("labels web addresses by host and app links by scheme and host", () => {
		expect(describeRedirectTarget("http://localhost:33418/callback")).toEqual({
			label: "localhost:33418",
			isApproved: true,
		});
		expect(
			describeRedirectTarget("https://claude.ai@evil.example/cb").label,
		).toBe("evil.example");
		expect(
			describeRedirectTarget("cursor://anysphere.cursor-mcp/oauth/callback")
				.label,
		).toBe("cursor://anysphere.cursor-mcp");
		expect(describeRedirectTarget("not a url")).toEqual({
			label: "not a url",
			isApproved: false,
		});
	});

	it("keeps the allowlist to the documented clients", () => {
		expect(APPROVED_MCP_CLIENT_REDIRECTS).toEqual({
			httpsDomains: ["claude.ai", "claude.com", "chatgpt.com", "openai.com"],
			loopbackHosts: ["localhost", "127.0.0.1", "[::1]"],
			appSchemes: ["cursor:", "vscode:", "vscode-insiders:", "windsurf:"],
		});
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
