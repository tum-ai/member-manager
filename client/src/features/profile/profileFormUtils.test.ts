import { describe, expect, it } from "vitest";
import {
	computeProfileCompleteness,
	getMissingOptionalProfileFields,
	getMissingProfileFields,
} from "./profileFormUtils";

const noBankDetails = {
	iban: "",
	bank_name: "",
	mandate_agreed: false,
	privacy_agreed: false,
};

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

	it("reaches 100 without any bank details (#361)", () => {
		expect(
			computeProfileCompleteness({ ...completeInput, sepa: noBankDetails }),
		).toBe(100);
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
				member: { ...completeInput.member, street: undefined, city: "" },
			}),
		).toEqual(["Street", "City"]);
	});

	it("never lists bank details as missing (#361)", () => {
		expect(
			getMissingProfileFields({ ...completeInput, sepa: noBankDetails }),
		).toEqual([]);
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

describe("getMissingOptionalProfileFields", () => {
	it("lists the bank details and their agreements while they are empty", () => {
		expect(
			getMissingOptionalProfileFields({
				...completeInput,
				sepa: noBankDetails,
			}),
		).toEqual([
			"IBAN",
			"Bank name",
			"SEPA mandate agreement",
			"Privacy agreement",
		]);
	});

	it("returns an empty list once bank details are complete", () => {
		expect(getMissingOptionalProfileFields(completeInput)).toEqual([]);
	});
});
