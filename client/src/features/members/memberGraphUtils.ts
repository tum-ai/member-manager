import {
	getEducationEntries,
	getOperationalDepartment,
	splitDegree,
} from "../../lib/memberMetadata";
import type { Member } from "../../types";

export const MEMBER_GRAPH_REASON_KINDS = [
	"batch",
	"department",
	"field",
	"research",
	"school",
	"location",
] as const;

export type MemberGraphReasonKind = (typeof MEMBER_GRAPH_REASON_KINDS)[number];

export const DEFAULT_MEMBER_GRAPH_REASON_KINDS = [
	"batch",
	"department",
	"field",
	"research",
] as const satisfies readonly MemberGraphReasonKind[];

export interface MemberGraphReason {
	kind: MemberGraphReasonKind;
	label: string;
	value: string;
}

export interface MemberGraphNode {
	id: string;
	member: Member;
	label: string;
	subtitle: string;
	componentId: number;
	componentSize: number;
	degree: number;
}

export interface MemberGraphEdge {
	id: string;
	source: string;
	target: string;
	reasons: MemberGraphReason[];
	weight: number;
}

export interface MemberGraphData {
	nodes: MemberGraphNode[];
	edges: MemberGraphEdge[];
	logicalEdgeCount: number;
	componentCount: number;
	largestComponentSize: number;
}

export interface BuildMemberGraphOptions {
	reasonKinds?: readonly MemberGraphReasonKind[];
	maxRenderedEdges?: number;
	maxRenderedDegree?: number;
}

const DEFAULT_MAX_RENDERED_EDGES = 420;
const DEFAULT_MAX_RENDERED_DEGREE = 8;

function normalize(value?: string | null): string {
	return value?.trim().toLowerCase() ?? "";
}

function getDisplayName(member: Member): string {
	return (
		`${member.given_name} ${member.surname}`.trim() || member.email || "Unnamed"
	);
}

function getMemberSubtitle(member: Member): string {
	const parts = [
		member.batch,
		getOperationalDepartment(member.department),
		member.member_role,
	]
		.map((part) => part?.trim())
		.filter(Boolean);
	return parts.join(" · ");
}

function getFieldValues(member: Member): string[] {
	return [
		...new Set(
			getEducationEntries(member.degree, member.school)
				.map((entry) => splitDegree(entry.degree).program.trim())
				.filter(Boolean),
		),
	];
}

function getSchoolValues(member: Member): string[] {
	return [
		...new Set(
			getEducationEntries(member.degree, member.school)
				.map((entry) => entry.school.trim())
				.filter(Boolean),
		),
	];
}

function findSharedValues(left: string[], right: string[]): string[] {
	const rightValues = new Map(right.map((value) => [normalize(value), value]));
	return left.filter((value) => rightValues.has(normalize(value)));
}

export function getMemberGraphReasons(
	left: Member,
	right: Member,
	reasonKinds: readonly MemberGraphReasonKind[] = DEFAULT_MEMBER_GRAPH_REASON_KINDS,
): MemberGraphReason[] {
	const enabled = new Set(reasonKinds);
	const reasons: MemberGraphReason[] = [];

	if (enabled.has("batch") && left.batch && left.batch === right.batch) {
		reasons.push({ kind: "batch", label: "Batch", value: left.batch });
	}

	const leftDepartment = getOperationalDepartment(left.department);
	const rightDepartment = getOperationalDepartment(right.department);
	if (
		enabled.has("department") &&
		leftDepartment &&
		leftDepartment === rightDepartment
	) {
		reasons.push({
			kind: "department",
			label: "Department",
			value: leftDepartment,
		});
	}

	if (enabled.has("field")) {
		for (const field of findSharedValues(
			getFieldValues(left),
			getFieldValues(right),
		)) {
			reasons.push({ kind: "field", label: "Field of study", value: field });
		}
	}

	if (
		enabled.has("research") &&
		left.research_project_id &&
		normalize(left.research_project_id) === normalize(right.research_project_id)
	) {
		reasons.push({
			kind: "research",
			label: "Research project",
			value: left.research_project_id,
		});
	}

	if (enabled.has("school")) {
		for (const school of findSharedValues(
			getSchoolValues(left),
			getSchoolValues(right),
		)) {
			reasons.push({ kind: "school", label: "School", value: school });
		}
	}

	if (
		enabled.has("location") &&
		left.public_location &&
		normalize(left.public_location) === normalize(right.public_location)
	) {
		reasons.push({
			kind: "location",
			label: "Location",
			value: left.public_location,
		});
	}

	return reasons;
}

function edgeId(leftId: string, rightId: string): string {
	return leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`;
}

function createUnionFind(nodeIds: string[]): {
	find: (id: string) => string;
	union: (left: string, right: string) => boolean;
} {
	const parent = new Map(nodeIds.map((id) => [id, id]));

	function find(id: string): string {
		const next = parent.get(id);
		if (!next || next === id) return id;
		const root = find(next);
		parent.set(id, root);
		return root;
	}

	return {
		find,
		union(left: string, right: string): boolean {
			const leftRoot = find(left);
			const rightRoot = find(right);
			if (leftRoot === rightRoot) {
				return false;
			}
			parent.set(rightRoot, leftRoot);
			return true;
		},
	};
}

function buildComponents(
	nodeIds: string[],
	edges: Pick<MemberGraphEdge, "source" | "target">[],
): Map<string, { id: number; size: number }> {
	const { find, union } = createUnionFind(nodeIds);

	for (const edge of edges) {
		union(edge.source, edge.target);
	}

	const roots = new Map<string, string[]>();
	for (const id of nodeIds) {
		const root = find(id);
		roots.set(root, [...(roots.get(root) ?? []), id]);
	}

	const sortedComponents = [...roots.values()].sort((left, right) => {
		if (right.length !== left.length) return right.length - left.length;
		return left[0].localeCompare(right[0]);
	});

	const result = new Map<string, { id: number; size: number }>();
	for (const [index, ids] of sortedComponents.entries()) {
		for (const id of ids) {
			result.set(id, { id: index + 1, size: ids.length });
		}
	}

	return result;
}

function sortEdgesBySignal(edges: MemberGraphEdge[]): MemberGraphEdge[] {
	return [...edges].sort((left, right) => {
		if (right.weight !== left.weight) return right.weight - left.weight;
		return left.id.localeCompare(right.id);
	});
}

function selectRenderedEdges(
	nodeIds: string[],
	candidateEdges: MemberGraphEdge[],
	maxRenderedEdges: number,
	maxRenderedDegree: number,
): MemberGraphEdge[] {
	const sortedEdges = sortEdgesBySignal(candidateEdges);
	const spanning = createUnionFind(nodeIds);
	const selected: MemberGraphEdge[] = [];
	const selectedIds = new Set<string>();
	const renderedDegree = new Map<string, number>();

	function addEdge(edge: MemberGraphEdge): void {
		selected.push(edge);
		selectedIds.add(edge.id);
		renderedDegree.set(edge.source, (renderedDegree.get(edge.source) ?? 0) + 1);
		renderedDegree.set(edge.target, (renderedDegree.get(edge.target) ?? 0) + 1);
	}

	// First preserve the same connected components as the full logical graph.
	while (true) {
		let bestEdge: MemberGraphEdge | null = null;
		let bestMaxDegree = Number.POSITIVE_INFINITY;
		let bestDegreeSum = Number.POSITIVE_INFINITY;

		for (const edge of sortedEdges) {
			if (selectedIds.has(edge.id)) continue;
			if (spanning.find(edge.source) === spanning.find(edge.target)) continue;

			const sourceDegree = renderedDegree.get(edge.source) ?? 0;
			const targetDegree = renderedDegree.get(edge.target) ?? 0;
			const maxDegree = Math.max(sourceDegree, targetDegree);
			const degreeSum = sourceDegree + targetDegree;
			if (
				!bestEdge ||
				maxDegree < bestMaxDegree ||
				(maxDegree === bestMaxDegree && degreeSum < bestDegreeSum) ||
				(maxDegree === bestMaxDegree &&
					degreeSum === bestDegreeSum &&
					edge.weight > bestEdge.weight) ||
				(maxDegree === bestMaxDegree &&
					degreeSum === bestDegreeSum &&
					edge.weight === bestEdge.weight &&
					edge.id.localeCompare(bestEdge.id) < 0)
			) {
				bestEdge = edge;
				bestMaxDegree = maxDegree;
				bestDegreeSum = degreeSum;
			}
		}

		if (!bestEdge) break;
		spanning.union(bestEdge.source, bestEdge.target);
		addEdge(bestEdge);
	}

	// Then add the strongest remaining local explanations without letting one
	// broad attribute dominate the whole drawing.
	const effectiveMaxRenderedEdges = Math.max(maxRenderedEdges, selected.length);
	for (const edge of sortedEdges) {
		if (selected.length >= effectiveMaxRenderedEdges) break;
		if (selectedIds.has(edge.id)) continue;
		if ((renderedDegree.get(edge.source) ?? 0) >= maxRenderedDegree) continue;
		if ((renderedDegree.get(edge.target) ?? 0) >= maxRenderedDegree) continue;
		addEdge(edge);
	}

	return selected;
}

export function buildMemberGraph(
	members: Member[],
	options: BuildMemberGraphOptions = {},
): MemberGraphData {
	const reasonKinds = options.reasonKinds ?? DEFAULT_MEMBER_GRAPH_REASON_KINDS;
	const maxRenderedEdges =
		options.maxRenderedEdges ?? DEFAULT_MAX_RENDERED_EDGES;
	const maxRenderedDegree =
		options.maxRenderedDegree ?? DEFAULT_MAX_RENDERED_DEGREE;
	const sortedMembers = [...members].sort((left, right) =>
		getDisplayName(left).localeCompare(getDisplayName(right)),
	);
	const candidateEdges: MemberGraphEdge[] = [];

	for (let i = 0; i < sortedMembers.length; i += 1) {
		for (let j = i + 1; j < sortedMembers.length; j += 1) {
			const left = sortedMembers[i];
			const right = sortedMembers[j];
			const reasons = getMemberGraphReasons(left, right, reasonKinds);
			if (reasons.length === 0) continue;
			candidateEdges.push({
				id: edgeId(left.user_id, right.user_id),
				source: left.user_id,
				target: right.user_id,
				reasons,
				weight: reasons.length,
			});
		}
	}

	const nodeIds = sortedMembers.map((member) => member.user_id);
	const edges = selectRenderedEdges(
		nodeIds,
		candidateEdges,
		maxRenderedEdges,
		maxRenderedDegree,
	);
	const degree = new Map<string, number>();
	for (const edge of edges) {
		degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
		degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
	}

	const components = buildComponents(nodeIds, candidateEdges);

	const nodes = sortedMembers.map((member) => {
		const component = components.get(member.user_id) ?? { id: 0, size: 1 };
		return {
			id: member.user_id,
			member,
			label: getDisplayName(member),
			subtitle: getMemberSubtitle(member),
			componentId: component.id,
			componentSize: component.size,
			degree: degree.get(member.user_id) ?? 0,
		};
	});

	return {
		nodes,
		edges,
		logicalEdgeCount: candidateEdges.length,
		componentCount: new Set(nodes.map((node) => node.componentId)).size,
		largestComponentSize: Math.max(
			0,
			...nodes.map((node) => node.componentSize),
		),
	};
}
