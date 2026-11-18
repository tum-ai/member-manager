import { describe, expect, it } from "vitest";
import { describeSaveOutcome, toSavePart } from "./profileSaveResult";

const saved = { status: "saved" } as const;
const skipped = { status: "skipped" } as const;
const failed = (message: string) => ({ status: "failed", message }) as const;

describe("toSavePart", () => {
	it("maps settled results", () => {
		expect(toSavePart({ status: "fulfilled", value: 1 })).toEqual(saved);
		expect(toSavePart("skipped")).toEqual(skipped);
		expect(
			toSavePart({ status: "rejected", reason: new Error("nope") }),
		).toEqual(failed("nope"));
		expect(toSavePart({ status: "rejected", reason: "boom" })).toEqual(
			failed("Unknown error"),
		);
	});
});

describe("describeSaveOutcome", () => {
	it("reports success when nothing failed, whether or not bank details were sent", () => {
		expect(describeSaveOutcome({ member: saved, sepa: saved })).toEqual({
			message: "Profile saved successfully!",
			type: "success",
		});
		expect(describeSaveOutcome({ member: saved, sepa: skipped })).toEqual({
			message: "Profile saved successfully!",
			type: "success",
		});
	});

	it("keeps the plain error when only the profile was sent and failed", () => {
		expect(
			describeSaveOutcome({ member: failed("network down"), sepa: skipped }),
		).toEqual({ message: "Error saving: network down", type: "error" });
	});

	it("says the profile was saved when only the bank details failed", () => {
		expect(
			describeSaveOutcome({ member: saved, sepa: failed("Invalid IBAN") }),
		).toEqual({
			message: "Profile saved, but your bank details were not: Invalid IBAN",
			type: "error",
		});
	});

	it("says the bank details were saved when only the profile failed", () => {
		expect(
			describeSaveOutcome({ member: failed("Invalid batch"), sepa: saved }),
		).toEqual({
			message: "Bank details saved, but your profile was not: Invalid batch",
			type: "error",
		});
	});

	it("reports the profile error when both failed", () => {
		expect(
			describeSaveOutcome({ member: failed("a"), sepa: failed("b") }),
		).toEqual({ message: "Error saving: a", type: "error" });
	});
});
