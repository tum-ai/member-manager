import { describe, expect, it } from "vitest";
import type { Member } from "../../types";
import {
	buildMemberGraph,
	getMemberGraphReasons,
	type MemberGraphReasonKind,
} from "./memberGraphUtils";

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

describe("member graph utilities", () => {
	it("explains shared member attributes as edge reasons", () => {
		const left = buildMember({
			user_id: "left",
			given_name: "Ada",
			surname: "Lovelace",
			batch: "WS24",
			department: "Research",
			degree: "M.Sc. Computer Science\nBachelor Management",
			school: "TUM\nLMU",
			research_project_id: "robotics-lab",
			public_location: "Munich",
		});
		const right = buildMember({
			user_id: "right",
			given_name: "Grace",
			surname: "Hopper",
			batch: "WS24",
			department: "Research",
			degree: "Bachelor Computer Science",
			school: "TUM",
			research_project_id: "robotics-lab",
			public_location: "Munich",
		});

		expect(
			getMemberGraphReasons(left, right, [
				"batch",
				"department",
				"field",
				"research",
				"school",
				"location",
			]),
		).toEqual([
			{ kind: "batch", label: "Batch", value: "WS24" },
			{ kind: "department", label: "Department", value: "Research" },
			{
				kind: "field",
				label: "Field of study",
				value: "Computer Science",
			},
			{
				kind: "research",
				label: "Research project",
				value: "robotics-lab",
			},
			{ kind: "school", label: "School", value: "TUM" },
			{ kind: "location", label: "Location", value: "Munich" },
		]);
	});

	it("builds connected components from selected reasons", () => {
		const members = [
			buildMember({
				user_id: "a",
				given_name: "Ada",
				surname: "A",
				batch: "WS24",
			}),
			buildMember({
				user_id: "b",
				given_name: "Ben",
				surname: "B",
				batch: "WS24",
			}),
			buildMember({
				user_id: "c",
				given_name: "Clara",
				surname: "C",
				department: "Software Development",
			}),
			buildMember({
				user_id: "d",
				given_name: "Dina",
				surname: "D",
				department: "Software Development",
			}),
			buildMember({
				user_id: "e",
				given_name: "Eli",
				surname: "E",
				batch: "SS22",
			}),
		];

		const graph = buildMemberGraph(members, {
			reasonKinds: ["batch", "department"],
		});

		expect(graph.edges).toHaveLength(2);
		expect(graph.componentCount).toBe(3);
		expect(graph.largestComponentSize).toBe(2);
		expect(graph.nodes.find((node) => node.id === "a")).toMatchObject({
			degree: 1,
			componentSize: 2,
		});
		expect(graph.nodes.find((node) => node.id === "e")).toMatchObject({
			degree: 0,
			componentSize: 1,
		});
	});

	it("preserves components while capping dense rendered edges", () => {
		const members = Array.from({ length: 8 }, (_, index) =>
			buildMember({
				user_id: `member-${index}`,
				given_name: `Member${index}`,
				surname: "Dense",
				batch: "WS24",
			}),
		);

		const graph = buildMemberGraph(members, {
			reasonKinds: ["batch"],
			maxRenderedEdges: 7,
			maxRenderedDegree: 3,
		});

		expect(graph.logicalEdgeCount).toBe(28);
		expect(graph.edges).toHaveLength(7);
		expect(graph.componentCount).toBe(1);
		expect(graph.largestComponentSize).toBe(8);
		expect(graph.nodes.every((node) => node.componentSize === 8)).toBe(true);
		expect(
			Math.max(...graph.nodes.map((node) => node.degree)),
		).toBeLessThanOrEqual(3);
	});

	it("keeps dense graphs sparse even below the rendered edge cap", () => {
		const members = Array.from({ length: 29 }, (_, index) =>
			buildMember({
				user_id: `member-${index}`,
				given_name: `Member${index}`,
				surname: "Dense",
				batch: "WS24",
			}),
		);

		const graph = buildMemberGraph(members, {
			reasonKinds: ["batch"],
			maxRenderedEdges: 420,
			maxRenderedDegree: 4,
		});

		expect(graph.logicalEdgeCount).toBe(406);
		expect(graph.edges.length).toBeLessThan(graph.logicalEdgeCount);
		expect(
			Math.max(...graph.nodes.map((node) => node.degree)),
		).toBeLessThanOrEqual(4);
		expect(graph.componentCount).toBe(1);
		expect(graph.largestComponentSize).toBe(29);
	});

	it("allows the sparse spanning forest to exceed a too-low render cap", () => {
		const members = Array.from({ length: 8 }, (_, index) =>
			buildMember({
				user_id: `member-${index}`,
				given_name: `Member${index}`,
				surname: "Dense",
				batch: "WS24",
			}),
		);

		const graph = buildMemberGraph(members, {
			reasonKinds: ["batch"],
			maxRenderedEdges: 2,
			maxRenderedDegree: 3,
		});

		expect(graph.edges).toHaveLength(7);
		expect(graph.componentCount).toBe(1);
		expect(graph.largestComponentSize).toBe(8);
	});

	it("keeps broad reasons opt-in", () => {
		const reasonKinds = [
			"batch",
			"department",
			"field",
			"research",
		] satisfies MemberGraphReasonKind[];
		const left = buildMember({
			user_id: "left",
			school: "TUM",
			public_location: "Munich",
		});
		const right = buildMember({
			user_id: "right",
			school: "TUM",
			public_location: "Munich",
		});

		expect(getMemberGraphReasons(left, right, reasonKinds)).toEqual([]);
		expect(getMemberGraphReasons(left, right, ["school", "location"])).toEqual([
			{ kind: "school", label: "School", value: "TUM" },
			{ kind: "location", label: "Location", value: "Munich" },
		]);
	});
});
