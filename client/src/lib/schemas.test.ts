import { describe, expect, it } from "vitest";
import { sepaSchema } from "./schemas";

const validSepaPayload = {
	iban: "DE89370400440532013000",
	bic: "COBADEFFXXX",
	bank_name: "Test Bank",
	mandate_agreed: true,
	privacy_agreed: true,
	user_id: "user-123",
};

describe("sepaSchema", () => {
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
});
