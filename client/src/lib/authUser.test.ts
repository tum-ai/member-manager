import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { keepSameUser } from "./authUser";

const ada = { id: "u1", email: "ada@tum.ai" } as User;

describe("keepSameUser", () => {
	it("keeps the current reference when the same user is re-emitted", () => {
		expect(keepSameUser(ada, { ...ada } as User)).toBe(ada);
	});

	it("switches to a different user", () => {
		const grace = { id: "u2" } as User;
		expect(keepSameUser(ada, grace)).toBe(grace);
	});

	it("signs in from, and out to, no user", () => {
		expect(keepSameUser(null, ada)).toBe(ada);
		expect(keepSameUser(ada, null)).toBeNull();
		expect(keepSameUser(null, null)).toBeNull();
	});
});
