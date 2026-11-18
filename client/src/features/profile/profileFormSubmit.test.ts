import { describe, expect, it } from "vitest";
import { describeSaveOutcome, toSavePart } from "./profileFormSubmit";

describe("toSavePart", () => {
	it("maps a fulfilled result to saved", () => {
		expect(toSavePart({ status: "fulfilled", value: {} })).toEqual({
			status: "saved",
		});
	});

	it("maps a skipped part", () => {
		expect(toSavePart("skipped")).toEqual({ status: "skipped" });
	});

	it("maps a rejection to failed with its message", () => {
		expect(
			toSavePart({ status: "rejected", reason: new Error("network down") }),
		).toEqual({ status: "failed", message: "network down" });
	});
});

describe("describeSaveOutcome", () => {
	it("reports full success", () => {
		expect(
			describeSaveOutcome({
				member: { status: "saved" },
				sepa: { status: "skipped" },
			}),
		).toEqual({ message: "Profile saved successfully!", type: "success" });
	});

	it("names a member failure after bank details saved", () => {
		expect(
			describeSaveOutcome({
				member: { status: "failed", message: "timeout" },
				sepa: { status: "saved" },
			}),
		).toEqual({
			message: "Bank details saved, but your profile was not: timeout",
			type: "error",
		});
	});
});
