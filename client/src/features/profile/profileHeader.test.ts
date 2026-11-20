import { describe, expect, it } from "vitest";
import { getProfileHeader } from "./profileHeader";

describe("getProfileHeader", () => {
	it("derives name, initials and department · role", () => {
		expect(
			getProfileHeader({
				given_name: "Ada",
				surname: "Lovelace",
				department: "Venture",
				member_role: "Team Lead",
			}),
		).toEqual({
			fullName: "Ada Lovelace",
			initials: "AL",
			meta: "Venture · Team Lead",
		});
	});

	it("defaults the role and drops a missing department", () => {
		expect(getProfileHeader({ given_name: "Ada", surname: "L" }).meta).toBe(
			"Member",
		);
	});

	it("shows a placeholder for an empty name", () => {
		expect(getProfileHeader({})).toEqual({
			fullName: "",
			initials: "?",
			meta: "Member",
		});
	});
});
