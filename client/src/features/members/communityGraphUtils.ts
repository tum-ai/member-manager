import { BOARD_MEMBER_ROLE } from "../../lib/constants";
import {
	getOperationalDepartment,
	splitDegree,
} from "../../lib/memberMetadata";
import type { Member } from "../../types";

export interface RelatedMember {
	member: Member;
	reasons: string[];
	score: number;
}

export interface PathGroup {
	id: string;
	columnId: string;
	label: string;
	helper: string;
	count: number;
	x: number;
	y: number;
}

export interface PathColumn {
	id: string;
	label: string;
	x: number;
	groups: PathGroup[];
}

export interface PathPoint {
	x: number;
	y: number;
	groupId: string;
}

export interface MemberPath {
	id: string;
	member: Member;
	points: PathPoint[];
	match: boolean;
	selected: boolean;
	connectedToSelection: boolean;
	reasons: string[];
	colorIndex: number;
}

export interface MemberGraphData {
	columns: PathColumn[];
	paths: MemberPath[];
	matches: Member[];
	selectedMember: Member;
	relatedMembers: RelatedMember[];
	visibleCount: number;
}

const COLUMN_DEFS = [
	{ id: "cohort", label: "Cohort", x: 8, helper: "batch" },
	{ id: "team", label: "Community home", x: 29, helper: "team" },
	{ id: "role", label: "Role", x: 50, helper: "role" },
	{ id: "program", label: "Program", x: 71, helper: "degree" },
	{ id: "school", label: "School", x: 92, helper: "school" },
] as const;

export function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase() || "?";
}

export function getDisplayName(member: Member): string {
	return `${member.given_name} ${member.surname}`.trim() || "Unnamed Member";
}

function normalize(value?: string | null): string {
	return value?.trim().toLowerCase() ?? "";
}

function readMemberText(member: Member, keys: string[]): string {
	for (const key of keys) {
		const value = member[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}

export function getBoardBadgeLabel(member: Member): string | undefined {
	if (member.member_role === "President") return "President";
	if (member.member_role === "Vice-President") return "Vice-President";

	const explicitRole = readMemberText(member, ["board_role", "boardRole"]);
	if (explicitRole === BOARD_MEMBER_ROLE) return "Board member";

	return member.department === "Board" ? "Board member" : undefined;
}

export function isBoardOnlyMember(member: Member): boolean {
	return (
		!getOperationalDepartment(member.department) &&
		(member.board_role === BOARD_MEMBER_ROLE || member.department === "Board")
	);
}

function getProjectReference(member: Member, kind: "research" | "innovation") {
	return readMemberText(
		member,
		kind === "research"
			? [
					"research_project_id",
					"researchProjectId",
					"research_project",
					"researchProject",
					"research_project_title",
					"researchProjectTitle",
				]
			: [
					"innovation_project_id",
					"innovationProjectId",
					"innovation_project",
					"innovationProject",
					"innovation_project_title",
					"innovationProjectTitle",
				],
	);
}

function getSharedSignals(left: Member, right: Member): string[] {
	const signals: string[] = [];
	const leftDepartment = getOperationalDepartment(left.department);
	const rightDepartment = getOperationalDepartment(right.department);
	const leftDegree = splitDegree(left.degree || "");
	const rightDegree = splitDegree(right.degree || "");
	const leftResearch = getProjectReference(left, "research");
	const rightResearch = getProjectReference(right, "research");
	const leftInnovation = getProjectReference(left, "innovation");
	const rightInnovation = getProjectReference(right, "innovation");

	if (leftDepartment && leftDepartment === rightDepartment) {
		signals.push(leftDepartment);
	}
	if (leftResearch && normalize(leftResearch) === normalize(rightResearch)) {
		signals.push(leftResearch);
	}
	if (
		leftInnovation &&
		normalize(leftInnovation) === normalize(rightInnovation)
	) {
		signals.push(leftInnovation);
	}
	if (getBoardBadgeLabel(left) && getBoardBadgeLabel(right)) {
		signals.push("Board circle");
	}
	if (leftDegree.program && leftDegree.program === rightDegree.program) {
		signals.push(leftDegree.program);
	} else if (leftDegree.type && leftDegree.type === rightDegree.type) {
		signals.push(leftDegree.type);
	}
	if (left.batch && left.batch === right.batch) signals.push(left.batch);
	if (left.school && left.school === right.school) signals.push(left.school);

	return [...new Set(signals)].slice(0, 3);
}

function getSignalScore(selected: Member, reason: string): number {
	if (reason === getOperationalDepartment(selected.department)) return 5;
	if (reason === getProjectReference(selected, "research")) return 6;
	if (reason === getProjectReference(selected, "innovation")) return 6;
	if (reason === "Board circle") return 4;
	if (reason === splitDegree(selected.degree || "").program) return 3;
	return 1;
}

export function getRelatedMembers(
	selected: Member,
	members: Member[],
): RelatedMember[] {
	return members
		.filter((member) => member.user_id !== selected.user_id)
		.map((member) => {
			const reasons = getSharedSignals(selected, member);
			return {
				member,
				reasons,
				score: reasons.reduce(
					(total, reason) => total + getSignalScore(selected, reason),
					0,
				),
			};
		})
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			return getDisplayName(left.member).localeCompare(
				getDisplayName(right.member),
			);
		});
}

export function getMemberTags(member: Member): string[] {
	const tags = [
		getBoardBadgeLabel(member),
		member.member_role && !isBoardOnlyMember(member)
			? member.member_role
			: undefined,
		getOperationalDepartment(member.department) ?? undefined,
		member.batch ?? undefined,
		member.degree ?? undefined,
		member.school ?? undefined,
	];
	return tags.filter((tag): tag is string => Boolean(tag));
}

function memberMatchesQuery(member: Member, query: string): boolean {
	const q = normalize(query);
	if (!q) return false;
	return [
		getDisplayName(member),
		getOperationalDepartment(member.department),
		member.member_role,
		member.board_role,
		member.batch,
		member.degree,
		member.school,
		getBoardBadgeLabel(member),
	]
		.filter(Boolean)
		.some((value) => normalize(value).includes(q));
}

function getColumnValue(member: Member, columnId: string): string {
	const degree = splitDegree(member.degree || "");
	switch (columnId) {
		case "cohort":
			return member.batch?.trim() || "No cohort";
		case "team":
			return (
				getOperationalDepartment(member.department) ||
				(isBoardOnlyMember(member) ? "Board" : "No team")
			);
		case "role":
			return (
				getBoardBadgeLabel(member) || member.member_role?.trim() || "Member"
			);
		case "program":
			return degree.program || degree.type || "No program";
		case "school":
			return member.school?.trim() || "No school";
		default:
			return "Unknown";
	}
}

function buildColumns(members: Member[]): PathColumn[] {
	return COLUMN_DEFS.map((column) => {
		const counts = new Map<string, number>();
		for (const member of members) {
			const value = getColumnValue(member, column.id);
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		const sorted = [...counts.entries()].sort((left, right) => {
			if (right[1] !== left[1]) return right[1] - left[1];
			return left[0].localeCompare(right[0]);
		});
		const top = 18;
		const span = 68;
		const groups = sorted.map(([label, count], index) => ({
			id: `${column.id}:${label}`,
			columnId: column.id,
			label,
			helper: column.helper,
			count,
			x: column.x,
			y: sorted.length === 1 ? 52 : top + (span * index) / (sorted.length - 1),
		}));
		return { id: column.id, label: column.label, x: column.x, groups };
	});
}

function getPathPoints(member: Member, columns: PathColumn[]): PathPoint[] {
	return columns.map((column) => {
		const value = getColumnValue(member, column.id);
		const group = column.groups.find((item) => item.label === value);
		return {
			x: group?.x ?? column.x,
			y: group?.y ?? 52,
			groupId: group?.id ?? `${column.id}:${value}`,
		};
	});
}

export function buildMemberGraph(
	members: Member[],
	selectedMemberId: string,
	query = "",
): MemberGraphData | null {
	if (members.length === 0) return null;
	const selectedMember =
		members.find((member) => member.user_id === selectedMemberId) ?? members[0];
	const relatedMembers = getRelatedMembers(selectedMember, members);
	const matches = query.trim()
		? members.filter((member) => memberMatchesQuery(member, query))
		: [];
	const priorityIds = new Set([
		selectedMember.user_id,
		...matches.map((member) => member.user_id),
		...relatedMembers.slice(0, 54).map((item) => item.member.user_id),
	]);
	const orderedMembers = [...members].sort((left, right) => {
		const leftPriority = priorityIds.has(left.user_id) ? 1 : 0;
		const rightPriority = priorityIds.has(right.user_id) ? 1 : 0;
		if (leftPriority !== rightPriority) return rightPriority - leftPriority;
		return getDisplayName(left).localeCompare(getDisplayName(right));
	});
	const visibleMembers = orderedMembers.slice(0, 150);
	const columns = buildColumns(visibleMembers);
	const paths = visibleMembers.map((member, index) => {
		const reasons = getSharedSignals(selectedMember, member);
		return {
			id: `path:${member.user_id}`,
			member,
			points: getPathPoints(member, columns),
			match: memberMatchesQuery(member, query),
			selected: member.user_id === selectedMember.user_id,
			connectedToSelection: reasons.length > 0,
			reasons,
			colorIndex: index % 5,
		};
	});

	return {
		columns,
		paths,
		matches,
		selectedMember,
		relatedMembers,
		visibleCount: visibleMembers.length,
	};
}
