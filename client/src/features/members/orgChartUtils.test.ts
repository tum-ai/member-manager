import { describe, expect, it } from "vitest";
import type { Member } from "../../types";
import { buildOrgChart } from "./orgChartUtils";

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Example",
		given_name: "Member",
		email: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		user_id: crypto.randomUUID(),
		member_status: "active",
		...overrides,
	};
}

describe("buildOrgChart", () => {
	it("groups executives, team leads, and department members while omitting board-only entries", () => {
		const chart = buildOrgChart([
			buildMember({
				user_id: "president",
				given_name: "Paula",
				surname: "President",
				department: "Board",
				member_role: "President",
			}),
			buildMember({
				user_id: "vice-president",
				given_name: "Victor",
				surname: "Vice",
				department: "Board",
				member_role: "Vice-President",
			}),
			buildMember({
				user_id: "sd-lead",
				given_name: "Taylor",
				surname: "Lead",
				department: "Software Development",
				member_role: "Team Lead",
			}),
			buildMember({
				user_id: "marketing-lead",
				given_name: "Morgan",
				surname: "Lead",
				department: "Marketing",
				member_role: "Team Lead",
			}),
			buildMember({
				user_id: "member-1",
				given_name: "Alice",
				surname: "Builder",
				department: "Software Development",
				member_role: "Member",
			}),
			buildMember({
				user_id: "member-2",
				given_name: "Mia",
				surname: "Maker",
				department: "Marketing",
				member_role: "Member",
			}),
			buildMember({
				user_id: "board-member",
				given_name: "Boris",
				surname: "Board",
				department: "Board",
				member_role: "Member",
			}),
			buildMember({
				user_id: "research-member",
				given_name: "Riley",
				surname: "Research",
				department: "Research",
				member_role: "Member",
			}),
		]);

		expect(chart.executives.map((member) => member.given_name)).toEqual([
			"Paula",
			"Victor",
		]);
		expect(chart.departments.map((group) => group.department)).toEqual([
			"Marketing",
			"Research",
			"Software Development",
		]);
		expect(
			chart.departments.find(
				(group) => group.department === "Software Development",
			),
		).toMatchObject({
			teamLeads: [expect.objectContaining({ given_name: "Taylor" })],
			members: [expect.objectContaining({ given_name: "Alice" })],
		});
		expect(
			chart.departments.find((group) => group.department === "Research"),
		).toMatchObject({
			teamLeads: [],
			members: [expect.objectContaining({ given_name: "Riley" })],
		});
		expect(
			chart.departments.flatMap((group) =>
				group.teamLeads
					.concat(group.members)
					.map((member) => member.given_name),
			),
		).not.toContain("Boris");
	});
});
