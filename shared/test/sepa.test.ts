import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hasBankDetailsInput, profileSepaSchema } from "../dist/index.js";

const validIban = "DE89370400440532013000";

const noBankDetails = {
	iban: "",
	bic: "",
	bank_name: "",
	mandate_agreed: false,
	privacy_agreed: false,
	data_privacy_notice_agreed: false,
};

function issuePaths(input: unknown): string[] {
	const result = profileSepaSchema.safeParse(input);
	assert.equal(result.success, false);
	return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("hasBankDetailsInput", () => {
	test("is false when every bank field is blank or missing", () => {
		assert.equal(hasBankDetailsInput({}), false);
		assert.equal(
			hasBankDetailsInput({ iban: "  ", bic: null, bank_name: "" }),
			false,
		);
	});

	test("is true when any single bank field is filled", () => {
		assert.equal(hasBankDetailsInput({ iban: "DE89" }), true);
		assert.equal(hasBankDetailsInput({ bic: "COBADEFFXXX" }), true);
		assert.equal(hasBankDetailsInput({ bank_name: "Test Bank" }), true);
	});

	test("treats stored ciphertext as present without inspecting it", () => {
		assert.equal(hasBankDetailsInput({ iban: "enc-v1:abc:def:ghi" }), true);
	});
});

describe("profileSepaSchema", () => {
	test("accepts a save without any bank details or agreements", () => {
		const parsed = profileSepaSchema.parse(noBankDetails);
		assert.deepEqual(parsed, noBankDetails);
	});

	test("saves agreements independently of bank details", () => {
		const parsed = profileSepaSchema.parse({
			...noBankDetails,
			privacy_agreed: true,
			data_privacy_notice_agreed: true,
		});
		assert.equal(parsed.privacy_agreed, true);
		assert.equal(parsed.data_privacy_notice_agreed, true);
		assert.equal(parsed.iban, "");
	});

	test("does not require the privacy agreements alongside bank details", () => {
		const parsed = profileSepaSchema.parse({
			...noBankDetails,
			iban: validIban,
			bank_name: "Test Bank",
			mandate_agreed: true,
		});
		assert.equal(parsed.privacy_agreed, false);
		assert.equal(parsed.data_privacy_notice_agreed, false);
	});

	test("normalizes a complete bank group", () => {
		const parsed = profileSepaSchema.parse({
			...noBankDetails,
			iban: "de89 3704 0044 0532 0130 00",
			bic: " COBADEFFXXX ",
			bank_name: " Test Bank ",
			mandate_agreed: true,
		});
		assert.equal(parsed.iban, validIban);
		assert.equal(parsed.bic, "COBADEFFXXX");
		assert.equal(parsed.bank_name, "Test Bank");
	});

	test("requires IBAN, bank name and mandate once any bank field is filled", () => {
		assert.deepEqual(issuePaths({ ...noBankDetails, bic: "COBADEFFXXX" }), [
			"iban",
			"bank_name",
			"mandate_agreed",
		]);
	});

	test("rejects a partial IBAN", () => {
		assert.deepEqual(
			issuePaths({
				...noBankDetails,
				iban: "DE8937",
				bank_name: "Test Bank",
				mandate_agreed: true,
			}),
			["iban"],
		);
	});

	test("rejects an IBAN with a bad checksum", () => {
		const result = profileSepaSchema.safeParse({
			...noBankDetails,
			iban: "DE89370400440532013001",
			bank_name: "Test Bank",
			mandate_agreed: true,
		});
		assert.equal(result.success, false);
		assert.equal(result.error?.issues[0]?.message, "Invalid IBAN");
	});

	test("rejects a whitespace-only bank name next to a valid IBAN", () => {
		assert.deepEqual(
			issuePaths({
				...noBankDetails,
				iban: validIban,
				bank_name: "   ",
				mandate_agreed: true,
			}),
			["bank_name"],
		);
	});
});
