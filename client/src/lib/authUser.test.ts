import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { reuseUserIfUnchanged } from "./authUser";

const makeUser = (overrides: Partial<User> = {}): User =>
	({
		id: "user-1",
		updated_at: "2026-11-15T09:00:00Z",
		user_metadata: {},
		...overrides,
	}) as User;

describe("reuseUserIfUnchanged", () => {
	it("keeps the previous object when the same account is emitted again", () => {
		const current = makeUser();

		expect(reuseUserIfUnchanged(current, makeUser())).toBe(current);
	});

	it("takes the new object when the account was updated", () => {
		const current = makeUser();
		const next = makeUser({ updated_at: "2026-11-15T10:00:00Z" });

		expect(reuseUserIfUnchanged(current, next)).toBe(next);
	});

	it("takes the new object for a different account", () => {
		const current = makeUser();
		const next = makeUser({ id: "user-2" });

		expect(reuseUserIfUnchanged(current, next)).toBe(next);
	});

	it("signs in and out", () => {
		const user = makeUser();

		expect(reuseUserIfUnchanged(null, user)).toBe(user);
		expect(reuseUserIfUnchanged(user, null)).toBeNull();
		expect(reuseUserIfUnchanged(null, null)).toBeNull();
	});
});
