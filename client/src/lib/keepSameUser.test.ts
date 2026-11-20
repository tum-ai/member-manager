import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { keepSameUser } from "@/lib/keepSameUser";

const user = (id: string, updated_at: string): User =>
	({ id, updated_at }) as User;

describe("keepSameUser", () => {
	it("keeps the previous reference for the same user and updated_at", () => {
		const previous = user("a", "1");
		expect(keepSameUser(previous, user("a", "1"))).toBe(previous);
	});

	it("takes the new user when the profile was updated", () => {
		const next = user("a", "2");
		expect(keepSameUser(user("a", "1"), next)).toBe(next);
	});

	it("takes the new user when the id differs or there was none", () => {
		const next = user("b", "1");
		expect(keepSameUser(user("a", "1"), next)).toBe(next);
		expect(keepSameUser(null, next)).toBe(next);
		expect(keepSameUser(next, null)).toBeNull();
	});
});
