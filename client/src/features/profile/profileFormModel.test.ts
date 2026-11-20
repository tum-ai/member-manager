import type { ProfileResponse } from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
	EMPTY_PROFILE_FORM_VALUES,
	getProfileSuggestions,
	getSuggestedFields,
	type ProfileFormValues,
	profileFormResolver,
	toFormValues,
	toUpdatePayload,
} from "./profileFormModel";

const suggestions = { given_name: "Ada", surname: "Lovelace", batch: "SS26" };

function profile(overrides: Partial<ProfileResponse["member"]> = {}) {
	return {
		version: 3,
		member: { user_id: "u1", ...overrides },
		sepa: {
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			data_privacy_notice_agreed: false,
		},
		completeness: { percent: 50, missing: [] },
	} satisfies ProfileResponse;
}

const filled: ProfileFormValues = {
	...EMPTY_PROFILE_FORM_VALUES,
	given_name: "Ada",
	surname: "Lovelace",
	batch: "SS25",
};

describe("toFormValues", () => {
	it("prefers stored values over suggestions", () => {
		const values = toFormValues(
			profile({ given_name: "Grace", surname: "Hopper", batch: "WS24" }),
			suggestions,
		);
		expect(values.given_name).toBe("Grace");
		expect(values.surname).toBe("Hopper");
		expect(values.batch).toBe("WS24");
	});

	it("fills only blank fields from the suggestions", () => {
		const values = toFormValues(profile({ given_name: "Grace" }), suggestions);
		expect(values.given_name).toBe("Grace");
		expect(values.surname).toBe("Lovelace");
		expect(values.batch).toBe("SS26");
	});

	it("maps bank details and defaults the country", () => {
		const values = toFormValues(profile(), suggestions);
		expect(values.iban).toBe("DE89370400440532013000");
		expect(values.mandate_agreed).toBe(true);
		expect(values.country).toBe("Germany");
	});

	it("falls back to empty values without a profile", () => {
		const values = toFormValues(undefined, {
			given_name: "",
			surname: "",
			batch: "",
		});
		expect(values).toEqual(EMPTY_PROFILE_FORM_VALUES);
	});
});

describe("getSuggestedFields", () => {
	it("flags fields that are only prefilled, never stored ones (#397)", () => {
		expect(
			getSuggestedFields(profile({ given_name: "Grace" }), suggestions),
		).toEqual(["surname", "batch"]);
		expect(
			getSuggestedFields(
				profile({ given_name: "G", surname: "H", batch: "WS24" }),
				suggestions,
			),
		).toEqual([]);
	});

	it("ignores a suggestion that is empty", () => {
		expect(
			getSuggestedFields(profile(), { given_name: "", surname: "", batch: "" }),
		).toEqual([]);
	});
});

describe("getProfileSuggestions", () => {
	it("derives the name from the Slack metadata and the batch from today", () => {
		const user = {
			id: "u1",
			user_metadata: { given_name: "Ada", family_name: "Lovelace" },
		} as unknown as User;
		const result = getProfileSuggestions(user);
		expect(result.given_name).toBe("Ada");
		expect(result.surname).toBe("Lovelace");
		expect(result.batch).toMatch(/^(WS|SS)\d{2}$/);
	});
});

describe("toUpdatePayload", () => {
	it("sends the version and no admin-managed fields for a member", () => {
		const payload = toUpdatePayload(
			{ ...filled, department: "Venture", member_role: "Team Lead" },
			{ version: 7, isAdmin: false },
		);
		expect(payload.version).toBe(7);
		expect(payload.member).not.toHaveProperty("member_role");
		expect(payload.member).not.toHaveProperty("department");
		expect(payload.member).not.toHaveProperty("research_project_id");
		expect(payload.member.batch).toBe("SS25");
	});

	it("keeps the research project for a member in the Research department", () => {
		const payload = toUpdatePayload(
			{ ...filled, department: "Research", research_project_id: "rp-1" },
			{ version: 1, isAdmin: false },
		);
		expect(payload.member.research_project_id).toBe("rp-1");
	});

	it("includes role and department for admins and clears the project outside Research", () => {
		const payload = toUpdatePayload(
			{
				...filled,
				member_role: "Member",
				department: "Venture",
				research_project_id: "rp-1",
			},
			{ version: 1, isAdmin: true },
		);
		expect(payload.member.member_role).toBe("Member");
		expect(payload.member.department).toBe("Venture");
		expect(payload.member.research_project_id).toBeNull();
	});

	it("gives executives no department", () => {
		const payload = toUpdatePayload(
			{ ...filled, member_role: "President", department: "Venture" },
			{ version: 1, isAdmin: true },
		);
		expect(payload.member.department).toBeNull();
	});

	it("turns blank optional text into null and passes bank details through", () => {
		const payload = toUpdatePayload(
			{
				...filled,
				batch: "",
				linkedin_profile_url: "  ",
				iban: "DE89370400440532013000",
				bank_name: "Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			},
			{ version: 1, isAdmin: false },
		);
		expect(payload.member.batch).toBeNull();
		expect(payload.member.linkedin_profile_url).toBeNull();
		expect(payload.sepa).toMatchObject({
			iban: "DE89370400440532013000",
			mandate_agreed: true,
		});
	});
});

describe("profileFormResolver", () => {
	async function errorsFor(values: ProfileFormValues) {
		const result = await profileFormResolver(
			values,
			undefined,
			{} as Parameters<typeof profileFormResolver>[2],
		);
		return result.errors as Record<string, { message?: string }>;
	}

	it("accepts a profile without bank details", async () => {
		expect(await errorsFor(filled)).toEqual({});
	});

	it("requires the names and rejects an invalid batch, date and LinkedIn url", async () => {
		const errors = await errorsFor({
			...filled,
			given_name: "",
			surname: "",
			batch: "XX99",
			date_of_birth: "2024-02-31",
			linkedin_profile_url: "https://example.com/in/ada",
		});
		expect(errors.given_name?.message).toBe("Given Name is required");
		expect(errors.surname?.message).toBe("Surname is required");
		expect(errors.batch?.message).toBe("Choose a valid batch");
		expect(errors.date_of_birth?.message).toBe("Invalid date");
		expect(errors.linkedin_profile_url?.message).toMatch(/LinkedIn/);
	});

	it("validates the bank group as soon as one bank field is filled", async () => {
		const errors = await errorsFor({ ...filled, bic: "COBADEFFXXX" });
		expect(errors.iban?.message).toBe("Invalid IBAN");
		expect(errors.bank_name?.message).toBe("Bank name is required");
		expect(errors.mandate_agreed?.message).toBe(
			"You must agree to the SEPA mandate",
		);
		expect(errors.privacy_agreed?.message).toBe(
			"You must agree to the Privacy Policy",
		);
	});

	it("accepts a complete bank group", async () => {
		expect(
			await errorsFor({
				...filled,
				iban: "de89 3704 0044 0532 0130 00",
				bank_name: "Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			}),
		).toEqual({});
	});
});
