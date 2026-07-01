import { describe, expect, it } from "vitest";
import type { Member } from "@/types";
import {
	buildMemberGraph,
	getDefaultSelectedNode,
	getHoverConnections,
	getInitials,
	getMemberGraphReasons,
	getReasonSummary,
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

	it("links members that share expertise tags (case-insensitive)", () => {
		const left = buildMember({
			user_id: "left",
			expertise_tags: ["Machine-Learning", "nlp"],
		});
		const right = buildMember({
			user_id: "right",
			expertise_tags: ["machine-learning", "robotics"],
		});

		expect(getMemberGraphReasons(left, right, ["expertise"])).toEqual([
			{ kind: "expertise", label: "Expertise", value: "Machine-Learning" },
		]);
		// Expertise is opt-in: no reason when the kind is not enabled.
		expect(getMemberGraphReasons(left, right, ["batch", "department"])).toEqual(
			[],
		);
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

	it("connects an expertise cluster through shared tags", () => {
		const members = [
			buildMember({
				user_id: "a",
				given_name: "Ada",
				surname: "A",
				expertise_tags: ["machine-learning", "nlp"],
			}),
			buildMember({
				user_id: "b",
				given_name: "Ben",
				surname: "B",
				expertise_tags: ["machine-learning"],
			}),
			buildMember({
				user_id: "c",
				given_name: "Clara",
				surname: "C",
				expertise_tags: ["design"],
			}),
		];

		const graph = buildMemberGraph(members, { reasonKinds: ["expertise"] });

		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0].reasons).toEqual([
			{ kind: "expertise", label: "Expertise", value: "machine-learning" },
		]);
		expect(graph.componentCount).toBe(2);
		expect(graph.largestComponentSize).toBe(2);
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
			expertise_tags: ["machine-learning"],
		});
		const right = buildMember({
			user_id: "right",
			school: "TUM",
			public_location: "Munich",
			expertise_tags: ["machine-learning"],
		});

		expect(getMemberGraphReasons(left, right, reasonKinds)).toEqual([]);
		expect(getMemberGraphReasons(left, right, ["school", "location"])).toEqual([
			{ kind: "school", label: "School", value: "TUM" },
			{ kind: "location", label: "Location", value: "Munich" },
		]);
	});
});

describe("member graph presentational helpers", () => {
	it("summarizes an edge's reasons", () => {
		const graph = buildMemberGraph(
			[
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
			],
			{ reasonKinds: ["batch"] },
		);
		expect(getReasonSummary(graph.edges[0])).toBe("Batch: WS24");
	});

	it("derives initials, falling back to email then a placeholder", () => {
		expect(
			getInitials(buildMember({ given_name: "Ada", surname: "Lovelace" })),
		).toBe("AL");
		expect(
			getInitials(
				buildMember({ given_name: "", surname: "", email: "zoe@example.com" }),
			),
		).toBe("Z");
		expect(
			getInitials(buildMember({ given_name: "", surname: "", email: "" })),
		).toBe("?");
	});

	it("orders hover connections by edge weight then label", () => {
		const members = [
			buildMember({
				user_id: "center",
				given_name: "Center",
				surname: "C",
				batch: "WS24",
				department: "Research",
			}),
			buildMember({
				user_id: "strong",
				given_name: "Strong",
				surname: "S",
				batch: "WS24",
				department: "Research",
			}),
			buildMember({
				user_id: "weak",
				given_name: "Weak",
				surname: "W",
				batch: "WS24",
			}),
		];
		const graph = buildMemberGraph(members, {
			reasonKinds: ["batch", "department"],
		});
		const connections = getHoverConnections(graph, "center");
		expect(connections.map((entry) => entry.neighbor.id)).toEqual([
			"strong",
			"weak",
		]);
	});

	it("selects the highest-degree node as the default", () => {
		const members = [
			buildMember({
				user_id: "hub",
				given_name: "Hub",
				surname: "H",
				batch: "WS24",
			}),
			buildMember({
				user_id: "spoke-1",
				given_name: "Spoke",
				surname: "One",
				batch: "WS24",
			}),
			buildMember({
				user_id: "spoke-2",
				given_name: "Spoke",
				surname: "Two",
				batch: "WS24",
			}),
			buildMember({
				user_id: "loner",
				given_name: "Loner",
				surname: "L",
				batch: "SS20",
			}),
		];
		const graph = buildMemberGraph(members, { reasonKinds: ["batch"] });
		const selected = getDefaultSelectedNode(graph);
		expect(selected).not.toBeNull();
		expect(selected?.componentSize).toBe(3);
		expect(selected?.degree).toBeGreaterThan(0);
	});
});
