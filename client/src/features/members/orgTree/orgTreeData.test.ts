import { describe, expect, it } from "vitest";
import type { Member } from "@/types";
import { buildOrgTree, type OrgTreeNode } from "./orgTreeData";

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

function byId(nodes: OrgTreeNode[], id: string): OrgTreeNode | undefined {
	return nodes.find((node) => node.id === id);
}

describe("buildOrgTree", () => {
	it("uses a single board card as the root", () => {
		const nodes = buildOrgTree([buildMember({ department: "Marketing" })]);
		const roots = nodes.filter((node) => node.parentId == null);
		expect(roots).toHaveLength(1);
		expect(roots[0].id).toBe("board");
		expect(roots[0].kind).toBe("board");
	});

	it("seats President, Vice-President and Board Members together on the board", () => {
		const nodes = buildOrgTree([
			buildMember({ user_id: "p", member_role: "President" }),
			buildMember({ user_id: "v", member_role: "Vice-President" }),
			buildMember({ user_id: "b", board_role: "Board Member" }),
		]);
		const seats = byId(nodes, "board")?.board ?? [];
		expect(seats.map((s) => s.role)).toEqual([
			"President",
			"Vice-President",
			"Board Member",
		]);
		// Board members are seats on the root card, not separate nodes.
		expect(nodes.some((n) => n.id.startsWith("board:"))).toBe(false);
	});

	it("centers departments directly below the board card", () => {
		const nodes = buildOrgTree([
			buildMember({
				user_id: "lead",
				member_role: "Team Lead",
				department: "Venture",
			}),
		]);
		expect(byId(nodes, "dept:Venture")?.parentId).toBe("board");
	});

	it("collects multiple co-leads onto one department node", () => {
		const nodes = buildOrgTree([
			buildMember({
				user_id: "a",
				given_name: "Anna",
				member_role: "Team Lead",
				department: "Software Development",
			}),
			buildMember({
				user_id: "b",
				given_name: "Carl",
				member_role: "Team Lead",
				department: "Software Development",
			}),
		]);
		const dept = byId(nodes, "dept:Software Development");
		expect(dept?.kind).toBe("department");
		expect(dept?.leads).toHaveLength(2);
		expect(nodes.filter((n) => n.id.startsWith("dept:"))).toHaveLength(1);
	});

	it("renders non-lead members as leaf person nodes under their department", () => {
		const nodes = buildOrgTree([
			buildMember({
				user_id: "lead",
				member_role: "Team Lead",
				department: "Marketing",
			}),
			buildMember({
				user_id: "m1",
				member_role: "Member",
				department: "Marketing",
			}),
		]);
		const memberNode = byId(nodes, "member:m1");
		expect(memberNode?.kind).toBe("person");
		expect(memberNode?.parentId).toBe("dept:Marketing");
		// Leads are not emitted as person nodes (they live on the department node).
		expect(byId(nodes, "member:lead")).toBeUndefined();
	});

	it("shows a board member who also leads a department in BOTH places", () => {
		const nodes = buildOrgTree([
			buildMember({
				user_id: "bl",
				given_name: "Bianca",
				board_role: "Board Member",
				member_role: "Team Lead",
				department: "Legal & Finance",
			}),
		]);
		const seats = byId(nodes, "board")?.board ?? [];
		expect(seats.some((s) => s.member.user_id === "bl")).toBe(true);
		const dept = byId(nodes, "dept:Legal & Finance");
		expect(dept?.leads?.some((m) => m.user_id === "bl")).toBe(true);
	});

	it("omits members without an operational department (no Unassigned bucket)", () => {
		const nodes = buildOrgTree([
			buildMember({ user_id: "x", member_role: "Member", department: "" }),
			buildMember({ user_id: "y", member_role: "Team Lead", department: "" }),
		]);
		expect(nodes.some((n) => n.id.startsWith("dept:"))).toBe(false);
		expect(byId(nodes, "member:x")).toBeUndefined();
	});

	it("links every non-root node to an existing parent (valid single tree)", () => {
		const nodes = buildOrgTree([
			buildMember({ user_id: "pres", member_role: "President" }),
			buildMember({
				user_id: "lead",
				member_role: "Team Lead",
				department: "Venture",
			}),
			buildMember({
				user_id: "m",
				member_role: "Member",
				department: "Venture",
			}),
		]);
		const ids = new Set(nodes.map((n) => n.id));
		for (const node of nodes) {
			if (node.parentId != null) expect(ids.has(node.parentId)).toBe(true);
		}
	});
});
