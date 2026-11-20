import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	computeProfileCompleteness,
	isValidIsoDate,
	profileMemberInputSchema,
	profileUpdateSchema,
} from "../dist/index.js";

const noBank = {
	iban: "",
	bic: "",
	bank_name: "",
	mandate_agreed: false,
	privacy_agreed: false,
};

describe("profileMemberInputSchema", () => {
	test("omitted keys stay omitted so a save never wipes them", () => {
		const parsed = profileMemberInputSchema.parse({ city: "Munich" });
		assert.deepEqual(parsed, { city: "Munich" });
		assert.equal(Object.hasOwn(parsed, "batch"), false);
	});

	test("empty strings and null clear nullable fields", () => {
		const parsed = profileMemberInputSchema.parse({
			batch: "",
			degree: null,
			department: "",
			linkedin_profile_url: "",
			public_location: "  ",
		});
		assert.equal(parsed.batch, null);
		assert.equal(parsed.degree, null);
		assert.equal(parsed.department, null);
		assert.equal(parsed.linkedin_profile_url, null);
		assert.equal(parsed.public_location, null);
	});

	test("accepts a valid batch and rejects an invalid one", () => {
		assert.equal(
			profileMemberInputSchema.parse({ batch: "WS25" }).batch,
			"WS25",
		);
		assert.equal(
			profileMemberInputSchema.safeParse({ batch: "XX99" }).success,
			false,
		);
	});

	test("validates dates and LinkedIn urls", () => {
		assert.equal(
			profileMemberInputSchema.safeParse({ date_of_birth: "2024-02-31" })
				.success,
			false,
		);
		assert.equal(
			profileMemberInputSchema.safeParse({ date_of_birth: "" }).success,
			true,
		);
		assert.equal(
			profileMemberInputSchema.safeParse({
				linkedin_profile_url: "https://example.com/in/ada",
			}).success,
			false,
		);
		assert.equal(
			profileMemberInputSchema.safeParse({
				linkedin_profile_url: "https://www.linkedin.com/in/ada",
			}).success,
			true,
		);
	});

	test("rejects an unknown member role", () => {
		assert.equal(
			profileMemberInputSchema.safeParse({ member_role: "Emperor" }).success,
			false,
		);
	});
});

describe("profileUpdateSchema", () => {
	test("requires a version and accepts agreements-only bank details", () => {
		assert.equal(
			profileUpdateSchema.safeParse({ member: {}, sepa: noBank }).success,
			false,
		);
		assert.equal(
			profileUpdateSchema.safeParse({ version: 1, member: {}, sepa: noBank })
				.success,
			true,
		);
	});
});

describe("computeProfileCompleteness", () => {
	const filled = {
		member: {
			given_name: "Ada",
			surname: "Lovelace",
			date_of_birth: "1990-01-01",
			street: "Main St",
			number: "1",
			postal_code: "80333",
			city: "Munich",
			country: "Germany",
			batch: "WS25",
			degree: "BSc",
			linkedin_profile_url: "https://linkedin.com/in/ada",
			public_location: "Munich",
		},
		sepa: {
			iban: "DE89370400440532013000",
			bank_name: "Bank",
			mandate_agreed: true,
			privacy_agreed: true,
		},
		consentsDecided: true,
	};

	test("is 100 % for a fully stored profile", () => {
		assert.deepEqual(computeProfileCompleteness(filled), {
			percent: 100,
			missing: [],
		});
	});

	test("lists what is missing and does not count unsaved batch", () => {
		const result = computeProfileCompleteness({
			...filled,
			member: { ...filled.member, batch: null },
		});
		assert.deepEqual(result.missing, ["TUM.ai batch"]);
		assert.equal(result.percent, 94);
	});

	test("an empty profile is 0 %", () => {
		const result = computeProfileCompleteness({
			member: {},
			sepa: {},
			consentsDecided: false,
		});
		assert.equal(result.percent, 0);
		assert.equal(result.missing.length, 17);
	});
});

describe("isValidIsoDate", () => {
	test("rejects non-calendar dates", () => {
		assert.equal(isValidIsoDate("2024-02-29"), true);
		assert.equal(isValidIsoDate("2023-02-29"), false);
		assert.equal(isValidIsoDate("24-02-29"), false);
	});
});
