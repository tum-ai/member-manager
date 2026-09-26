import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	cleanIbanInput,
	formatIban,
	isValidIban,
	maskIban,
	normalizeIban,
	sepaSchema,
} from "../dist/index.js";

const validIban = "DE89370400440532013000";

describe("IBAN formatting", () => {
	test("groups an IBAN into blocks of four", () => {
		assert.equal(formatIban(validIban), "DE89 3704 0044 0532 0130 00");
		assert.equal(formatIban("NL91ABNA0417164300"), "NL91 ABNA 0417 1643 00");
	});

	test("normalizes spacing, hyphens, and case before grouping", () => {
		assert.equal(
			formatIban("de89-3704 00440532 013000"),
			"DE89 3704 0044 0532 0130 00",
		);
	});

	test("formats partial input without a trailing separator", () => {
		assert.equal(formatIban("DE8937"), "DE89 37");
		assert.equal(formatIban("DE89"), "DE89");
		assert.equal(formatIban(""), "");
	});
});

describe("IBAN input cleaning", () => {
	test("strips an IBAN label and punctuation", () => {
		assert.equal(
			cleanIbanInput("IBAN: DE89 3704 0044 0532 0130 00"),
			validIban,
		);
		assert.equal(cleanIbanInput("iban de89.3704.0044.0532.0130.00"), validIban);
		assert.equal(cleanIbanInput("de89-3704-0044-0532-0130-00"), validIban);
	});

	test("keeps a partial value that merely starts like a label", () => {
		assert.equal(cleanIbanInput("IBA"), "IBA");
		assert.equal(cleanIbanInput("IBAN"), "IBAN");
		assert.equal(cleanIbanInput("IBAND"), "IBAND");
	});
});

describe("IBAN validation", () => {
	test("normalizes spaces, hyphens, and lowercase input", () => {
		assert.equal(
			normalizeIban("ｄｅ89\u00a03704-0044\t0532 0130 00"),
			validIban,
		);
	});

	test("validates the country format and checksum", () => {
		assert.equal(isValidIban(validIban), true);
		assert.equal(isValidIban("DE89370400440532013001"), false);
		assert.equal(isValidIban("XX89370400440532013000"), false);
	});

	test("normalizes valid SEPA payloads and rejects invalid IBANs", () => {
		const payload = {
			iban: "de89 3704 0044 0532 0130 00",
			bic: "COBADEFFXXX",
			bank_name: "Test Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			data_privacy_notice_agreed: true,
			user_id: "user-123",
		};

		assert.equal(sepaSchema.parse(payload).iban, validIban);
		assert.equal(
			sepaSchema.safeParse({ ...payload, iban: "DE89370400440532013001" })
				.success,
			false,
		);
	});
});

describe("IBAN masking", () => {
	test("keeps only the country code, check digits, and last four characters", () => {
		assert.equal(maskIban(validIban), "DE89 •••• •••• 3000");
	});

	test("normalizes formatted input before masking", () => {
		assert.equal(
			maskIban(" de89 3704-0044 0532 0130 00 "),
			"DE89 •••• •••• 3000",
		);
	});

	test("never reveals the middle of the account number", () => {
		const masked = maskIban(validIban);
		assert.equal(masked.includes("370400440532"), false);
		assert.equal(masked.replace(/[^A-Z0-9]/g, "").length, 8);
	});

	test("returns an empty string for blank input", () => {
		assert.equal(maskIban(""), "");
		assert.equal(maskIban("   "), "");
	});

	test("fully masks values too short to be an IBAN", () => {
		assert.equal(maskIban("DE891234"), "••••");
		assert.equal(maskIban("DE8912345"), "••••");
	});
});
