import { describe, expect, it } from "vitest";
import type { InnovationProject, Member } from "../../types";
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
	it("groups board responsibilities, departments, research projects, and innovation projects", () => {
		const innovationProjects: InnovationProject[] = [
			{
				id: "innovation-a",
				title: "Women@TUM.ai",
				description: "Female empowerment and mentorship.",
				detailedDescription: "Detailed project description.",
				image: "",
			},
		];
		const chart = buildOrgChart(
			[
				buildMember({
					user_id: "president",
					given_name: "Paula",
					surname: "President",
					department: "Software Development",
					member_role: "President",
				}),
				buildMember({
					user_id: "vice-president",
					given_name: "Victor",
					surname: "Vice",
					department: null,
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
					board_role: "Board Member",
					research_project_id: "project-a",
					innovation_project_id: "innovation-a",
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
					user_id: "research-lead",
					given_name: "Lea",
					surname: "Research",
					department: "Research",
					member_role: "Team Lead",
					research_project_id: "project-a",
				}),
				buildMember({
					user_id: "research-member",
					given_name: "Riley",
					surname: "Research",
					department: "Research",
					member_role: "Member",
					research_project_id: "project-a",
				}),
				buildMember({
					user_id: "innovation-lead",
					given_name: "Iris",
					surname: "Innovation",
					department: "Marketing",
					member_role: "Member",
					innovation_project_id: "innovation-a",
					innovation_project_role: "Lead",
				}),
				buildMember({
					user_id: "innovation-member",
					given_name: "Ivan",
					surname: "Innovation",
					department: "Software Development",
					member_role: "Team Lead",
					innovation_project_id: "innovation-a",
				}),
			],
			[
				{
					id: "project-a",
					title: "Alpha Research",
					description: "Current project",
					status: "ongoing",
				},
				{
					id: "project-b",
					title: "Past Research",
					status: "completed",
				},
			],
			innovationProjects,
		);

		expect(chart.board.presidents.map((member) => member.given_name)).toEqual([
			"Paula",
		]);
		expect(
			chart.board.vicePresidents.map((member) => member.given_name),
		).toEqual(["Victor"]);
		expect(chart.board.members.map((member) => member.given_name)).toEqual([
			"Alice",
			"Boris",
		]);
		expect(chart.departments.map((group) => group.department)).toEqual([
			"Marketing",
			"Software Development",
		]);
		expect(
			chart.departments.find(
				(group) => group.department === "Software Development",
			),
		).toMatchObject({
			teamLeads: [
				expect.objectContaining({ given_name: "Ivan" }),
				expect.objectContaining({ given_name: "Taylor" }),
			],
			members: [
				expect.objectContaining({ given_name: "Alice" }),
				expect.objectContaining({ given_name: "Paula" }),
			],
		});
		expect(
			chart.departments.flatMap((group) =>
				group.teamLeads
					.concat(group.members)
					.map((member) => member.given_name),
			),
		).not.toContain("Boris");
		expect(
			chart.departments.flatMap((group) =>
				group.teamLeads
					.concat(group.members)
					.map((member) => member.given_name),
			),
		).not.toContain("Riley");
		expect(chart.researchProjects).toHaveLength(1);
		expect(chart.researchProjects[0]).toMatchObject({
			id: "project-a",
			title: "Alpha Research",
			leadSupervisor: expect.objectContaining({ given_name: "Lea" }),
			members: [
				expect.objectContaining({ given_name: "Alice" }),
				expect.objectContaining({ given_name: "Riley" }),
			],
		});
		expect(chart.innovationProjects).toHaveLength(1);
		expect(chart.innovationProjects[0]).toMatchObject({
			id: "innovation-a",
			title: "Women@TUM.ai",
			leads: [expect.objectContaining({ given_name: "Iris" })],
			members: [
				expect.objectContaining({ given_name: "Alice" }),
				expect.objectContaining({ given_name: "Ivan" }),
			],
		});
	});
});
