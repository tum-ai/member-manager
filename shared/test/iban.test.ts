import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isValidIban, normalizeIban, sepaSchema } from "../dist/index.js";

const validIban = "DE89370400440532013000";

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
