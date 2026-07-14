import { describe, expect, it } from "vitest";
import { linkedinSchema, sepaSchema } from "./schemas";

const validSepaPayload = {
	iban: "DE89370400440532013000",
	bic: "COBADEFFXXX",
	bank_name: "Test Bank",
	mandate_agreed: true,
	privacy_agreed: true,
	data_privacy_notice_agreed: true,
	user_id: "user-123",
};

describe("sepaSchema", () => {
	it("normalizes valid IBANs and rejects invalid checksums", () => {
		const validResult = sepaSchema.safeParse({
			...validSepaPayload,
			iban: "de89 3704-0044 0532 0130 00",
		});
		const invalidResult = sepaSchema.safeParse({
			...validSepaPayload,
			iban: "DE89370400440532013001",
		});

		expect(validResult.success).toBe(true);
		expect(validResult.data?.iban).toBe("DE89370400440532013000");
		expect(invalidResult.success).toBe(false);
		expect(invalidResult.error?.issues[0]?.message).toBe("Invalid IBAN");
	});

	it("requires the SEPA mandate agreement", () => {
		const result = sepaSchema.safeParse({
			...validSepaPayload,
			mandate_agreed: false,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			"You must agree to the SEPA mandate",
		);
	});

	it("requires the Privacy Policy agreement", () => {
		const result = sepaSchema.safeParse({
			...validSepaPayload,
			privacy_agreed: false,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			"You must agree to the Privacy Policy",
		);
	});

	it("requires the Data Privacy Notice agreement", () => {
		const result = sepaSchema.safeParse({
			...validSepaPayload,
			data_privacy_notice_agreed: false,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			"You must agree to the Data Privacy Notice",
		);
	});
});

describe("linkedinSchema", () => {
	it("accepts LinkedIn profile URLs and rejects arbitrary URLs", () => {
		expect(
			linkedinSchema.safeParse({
				linkedin_profile_url: "https://linkedin.com/in/example-profile",
			}).success,
		).toBe(true);

		expect(
			linkedinSchema.safeParse({
				linkedin_profile_url: "https://example.com/in/example-profile",
			}).success,
		).toBe(false);
	});
});
