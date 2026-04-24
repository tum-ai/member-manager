import { describe, expect, it } from "vitest";
import {
	type AdminFilters,
	type AdminMember,
	filterAdminMembers,
} from "./adminUtils";

const baseFilters: AdminFilters = {
	search: "",
	mandateAgreed: "",
	privacyAgreed: "",
	active: "",
};

const members: AdminMember[] = [
	{
		user_id: "member-accepted",
		given_name: "Ada",
		surname: "Lovelace",
		email: "ada@tum.ai",
		phone: "+49111111111",
		active: true,
		salutation: "",
		title: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		department: "Tech",
		member_role: "Member",
		degree: "M.Sc.",
		school: "TUM",
		sepa: {
			iban: "DE001234",
			bic: "TUMAIDEF",
			bank_name: "TUM.ai Bank",
			mandate_agreed: true,
			privacy_agreed: true,
		},
	},
	{
		user_id: "member-missing-sepa",
		given_name: "Grace",
		surname: "Hopper",
		email: "grace@tum.ai",
		phone: "+49222222222",
		active: false,
		salutation: "",
		title: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		department: "Operations",
		member_role: "Member",
		degree: "B.Sc.",
		school: "LMU",
		sepa: {},
	},
];

describe("filterAdminMembers", () => {
	it("treats missing SEPA data as not accepted for the mandate filter", () => {
		const filtered = filterAdminMembers(members, {
			...baseFilters,
			mandateAgreed: "false",
		});

		expect(filtered.map((member) => member.user_id)).toEqual([
			"member-missing-sepa",
		]);
	});

	it("treats missing SEPA data as not accepted for the privacy filter", () => {
		const filtered = filterAdminMembers(members, {
			...baseFilters,
			privacyAgreed: "false",
		});

		expect(filtered.map((member) => member.user_id)).toEqual([
			"member-missing-sepa",
		]);
	});
});
