import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
	extractSlackProfile,
	fromSelectValue,
	NONE_VALUE,
	normalizeSerializedTextValue,
	normalizeTextValue,
	toSelectValue,
} from "./profileUtils";

const makeUser = (metadata: Record<string, unknown>): User =>
	({ id: "user-1", user_metadata: metadata }) as unknown as User;

describe("profileUtils select sentinel", () => {
	it("maps empty string to the NONE sentinel and back", () => {
		expect(toSelectValue("")).toBe(NONE_VALUE);
		expect(toSelectValue("Mr.")).toBe("Mr.");
		expect(fromSelectValue(NONE_VALUE)).toBe("");
		expect(fromSelectValue("Mr.")).toBe("Mr.");
	});
});

describe("normalizeTextValue", () => {
	it("trims and returns null for empty values", () => {
		expect(normalizeTextValue("  hi ")).toBe("hi");
		expect(normalizeTextValue("   ")).toBeNull();
		expect(normalizeTextValue(undefined)).toBeNull();
		expect(normalizeTextValue(null)).toBeNull();
	});
});

describe("normalizeSerializedTextValue", () => {
	it("normalizes newlines and returns null for blank input", () => {
		expect(normalizeSerializedTextValue("a\r\nb\rc")).toBe("a\nb\nc");
		expect(normalizeSerializedTextValue("   ")).toBeNull();
		expect(normalizeSerializedTextValue(null)).toBeNull();
	});
});

describe("extractSlackProfile", () => {
	it("prefers explicit given/family name fields", () => {
		expect(
			extractSlackProfile(
				makeUser({ given_name: " Ada ", family_name: "Lovelace" }),
			),
		).toEqual({ given_name: "Ada", surname: "Lovelace" });
	});

	it("falls back to first/last name aliases", () => {
		expect(
			extractSlackProfile(
				makeUser({ first_name: "Grace", last_name: "Hopper" }),
			),
		).toEqual({ given_name: "Grace", surname: "Hopper" });
	});

	it("splits a full name when discrete fields are missing", () => {
		expect(
			extractSlackProfile(makeUser({ name: "Alan Mathison Turing" })),
		).toEqual({ given_name: "Alan", surname: "Mathison Turing" });
	});

	it("returns empty strings when no metadata is present", () => {
		expect(extractSlackProfile(makeUser({}))).toEqual({
			given_name: "",
			surname: "",
		});
	});
});
