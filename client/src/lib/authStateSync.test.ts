import { describe, expect, it } from "vitest";
import { shouldSyncAuthUserToReact } from "./authStateSync";

describe("shouldSyncAuthUserToReact", () => {
	it("ignores token refresh on tab focus", () => {
		expect(shouldSyncAuthUserToReact("TOKEN_REFRESHED")).toBe(false);
	});

	it("syncs sign-in, sign-out, and profile updates", () => {
		expect(shouldSyncAuthUserToReact("INITIAL_SESSION")).toBe(true);
		expect(shouldSyncAuthUserToReact("SIGNED_IN")).toBe(true);
		expect(shouldSyncAuthUserToReact("SIGNED_OUT")).toBe(true);
		expect(shouldSyncAuthUserToReact("USER_UPDATED")).toBe(true);
	});
});
