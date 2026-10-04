import { describe, expect, it } from "vitest";
import {
	computeProfileCompleteness,
	getMissingProfileFields,
} from "./profileFormUtils";

const completeInput = {
	member: {
		given_name: "Alice",
		surname: "Example",
		date_of_birth: "1999-01-01",
		street: "Main St",
		number: "1",
		postal_code: "80333",
		city: "Munich",
		country: "Germany",
		batch: "24",
		degree: "M.Sc. Informatics",
	},
	linkedin: {
		linkedin_profile_url: "https://linkedin.com/in/alice",
		public_location: "Munich",
	},
	sepa: {
		iban: "DE89370400440532013000",
		bank_name: "Commerzbank",
		mandate_agreed: true,
		privacy_agreed: true,
	},
	consentsDecided: true,
};

describe("computeProfileCompleteness", () => {
	it("returns 100 when every tracked field is filled", () => {
		expect(computeProfileCompleteness(completeInput)).toBe(100);
	});

	it("returns 0 when nothing is filled", () => {
		expect(
			computeProfileCompleteness({
				member: {},
				linkedin: {},
				sepa: {},
				consentsDecided: false,
			}),
		).toBe(0);
	});

	it("ignores whitespace-only values as unfilled", () => {
		expect(
			computeProfileCompleteness({
				...completeInput,
				member: { ...completeInput.member, given_name: "   " },
			}),
		).toBeLessThan(100);
	});
});

describe("getMissingProfileFields", () => {
	it("returns an empty list when everything is filled", () => {
		expect(getMissingProfileFields(completeInput)).toEqual([]);
	});

	it("lists exactly the unfilled fields", () => {
		expect(
			getMissingProfileFields({
				...completeInput,
				sepa: { ...completeInput.sepa, iban: undefined, bank_name: "" },
			}),
		).toEqual(["IBAN", "Bank name"]);
	});

	it("counts the consent item once a decision is saved, whatever the answers", () => {
		// Every Data Privacy Notice purpose is optional; refusing them all is a
		// complete answer.
		expect(getMissingProfileFields(completeInput)).not.toContain(
			"Data privacy consent choices",
		);
		expect(
			getMissingProfileFields({ ...completeInput, consentsDecided: false }),
		).toEqual(["Data privacy consent choices"]);
	});
});
