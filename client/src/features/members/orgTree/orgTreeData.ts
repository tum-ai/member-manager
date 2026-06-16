import { BOARD_MEMBER_ROLE } from "../../../lib/constants";
import { getOperationalDepartment } from "../../../lib/memberMetadata";
import type { Member } from "../../../types";
import { getDisplayName } from "../orgChartShared";

export type OrgNodeKind = "board" | "department" | "person";

/** A single occupant of the board card, with their board role label. */
export interface BoardSeat {
	member: Member;
	role: string;
}

/**
 * A single node in the synthesized org hierarchy. d3-org-chart consumes a flat
 * array of these (linked by `id`/`parentId`) and builds the tree itself.
 */
export interface OrgTreeNode {
	id: string;
	parentId?: string;
	kind: OrgNodeKind;
	/** Group title (department) or the label for the board card. */
	title?: string;
	/** Subtitle: a person's department, or a group's category label. */
	roleLabel?: string;
	/** Board occupants rendered side-by-side inside the root board card. */
	board?: BoardSeat[];
	/** Co-leads shown side-by-side inside a department node. */
	leads?: Member[];
	/** The individual member rendered by a `person` node. */
	member?: Member;
	/** Total members represented (org total, or a department's headcount). */
	memberCount?: number;
	/** Department nodes get a brand accent treatment. */
	accent?: boolean;
}

const ROOT_ID = "board";

function sortByName(left: Member, right: Member): number {
	return getDisplayName(left).localeCompare(getDisplayName(right));
}

function pushTo(map: Map<string, Member[]>, key: string, member: Member): void {
	const existing = map.get(key);
	if (existing) {
		existing.push(member);
	} else {
		map.set(key, [member]);
	}
}

/** Whether a member sits on the board (explicit role or the "Board" department). */
export function isBoardMember(member: Member): boolean {
	const explicit =
		typeof member.board_role === "string" ? member.board_role.trim() : "";
	return (
		explicit === BOARD_MEMBER_ROLE || member.department?.trim() === "Board"
	);
}

/**
 * Synthesize a single-rooted org hierarchy from the flat member list:
 *
 *   Board card (President + Vice-Presidents + Board Members, one uniform row)
 *     └─ Department (co-leads shown together), centered below the whole board
 *          └─ member leaves
 *
 * The board is the single root, so departments fan out centered beneath the
 * entire board rather than under any one person. Department leadership is
 * additive: a board member who also leads a department appears both as a board
 * seat AND as a co-lead of that department. Members without an operational
 * department are omitted entirely (no "Unassigned" bucket).
 */
export function buildOrgTree(members: Member[]): OrgTreeNode[] {
	const presidents: Member[] = [];
	const vicePresidents: Member[] = [];
	const boardMembers: Member[] = [];
	const departmentLeads = new Map<string, Member[]>();
	const departmentMembers = new Map<string, Member[]>();

	for (const member of members) {
		const role = member.member_role?.trim();
		const board = isBoardMember(member);
		const department = getOperationalDepartment(member.department);

		// Board seats — President, Vice-President and Board Members share the card.
		if (role === "President") {
			presidents.push(member);
		} else if (role === "Vice-President") {
			vicePresidents.push(member);
		} else if (board) {
			boardMembers.push(member);
		}

		// Department placement is independent of board status (a board member can
		// also co-lead a department). Members without a real department are dropped.
		if (role === "Team Lead") {
			if (department) pushTo(departmentLeads, department, member);
		} else if (role !== "President" && role !== "Vice-President" && !board) {
			if (department) pushTo(departmentMembers, department, member);
		}
	}

	const seats: BoardSeat[] = [
		...[...presidents].sort(sortByName).map((member) => ({
			member,
			role: "President",
		})),
		...[...vicePresidents].sort(sortByName).map((member) => ({
			member,
			role: "Vice-President",
		})),
		...[...boardMembers].sort(sortByName).map((member) => ({
			member,
			role: "Board Member",
		})),
	];

	const nodes: OrgTreeNode[] = [
		{
			id: ROOT_ID,
			kind: "board",
			title: "Executive Board",
			board: seats,
			memberCount: seats.length,
		},
	];

	const departmentNames = new Set([
		...departmentLeads.keys(),
		...departmentMembers.keys(),
	]);
	const sortedDepartments = [...departmentNames].sort((left, right) =>
		left.localeCompare(right),
	);

	for (const department of sortedDepartments) {
		const leads = [...(departmentLeads.get(department) ?? [])].sort(sortByName);
		const teamMembers = [...(departmentMembers.get(department) ?? [])].sort(
			sortByName,
		);
		const departmentId = `dept:${department}`;

		nodes.push({
			id: departmentId,
			parentId: ROOT_ID,
			kind: "department",
			title: department,
			roleLabel: "Department",
			leads,
			accent: true,
			memberCount: leads.length + teamMembers.length,
		});

		for (const member of teamMembers) {
			nodes.push({
				id: `member:${member.user_id}`,
				parentId: departmentId,
				kind: "person",
				member,
				roleLabel: department,
			});
		}
	}

	return nodes;
}
