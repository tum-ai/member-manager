import { describe, expect, it } from "vitest";
import { getSlackRedirectUrl } from "./authRedirect";

describe("getSlackRedirectUrl", () => {
	it("prefers the current deployment origin", () => {
		expect(
			getSlackRedirectUrl({
				currentOrigin: "https://member-manager-1g1lmdm6b-tum-ai.vercel.app",
				configuredRedirectUrl: "https://member-manager.tum-ai.com/",
			}),
		).toBe("https://member-manager-1g1lmdm6b-tum-ai.vercel.app/");
	});

	it("uses the configured fallback when no runtime origin is available", () => {
		expect(
			getSlackRedirectUrl({
				configuredRedirectUrl: "https://member-manager.tum-ai.com",
			}),
		).toBe("https://member-manager.tum-ai.com/");
	});

	it("falls back to localhost for local/dev tooling", () => {
		expect(getSlackRedirectUrl()).toBe("http://localhost:5173/");
	});
});
