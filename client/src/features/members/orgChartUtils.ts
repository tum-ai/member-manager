import { BOARD_MEMBER_ROLE } from "../../lib/constants";
import { getOperationalDepartment } from "../../lib/memberMetadata";
import type { Member } from "../../types";

export interface OrgChartDepartmentGroup {
	department: string;
	teamLeads: Member[];
	members: Member[];
}

export interface OrgChartData {
	executives: Member[];
	boardMembers: Member[];
	departments: OrgChartDepartmentGroup[];
}

function getMemberDisplayName(member: Member): string {
	return `${member.given_name} ${member.surname}`.trim();
}

function sortMembers(left: Member, right: Member): number {
	return getMemberDisplayName(left).localeCompare(getMemberDisplayName(right));
}

function getExecutiveRank(role?: string | null): number {
	switch (role) {
		case "President":
			return 0;
		case "Vice-President":
			return 1;
		default:
			return 2;
	}
}

export function buildOrgChart(members: Member[]): OrgChartData {
	const executives = members
		.filter(
			(member) =>
				member.member_role === "President" ||
				member.member_role === "Vice-President",
		)
		.sort(
			(left, right) =>
				getExecutiveRank(left.member_role) -
					getExecutiveRank(right.member_role) || sortMembers(left, right),
		);
	const executiveIds = new Set(executives.map((member) => member.user_id));
	const boardMembers = members
		.filter(
			(member) =>
				member.board_role === BOARD_MEMBER_ROLE &&
				!executiveIds.has(member.user_id),
		)
		.sort(sortMembers);

	const departments = new Map<string, OrgChartDepartmentGroup>();

	for (const member of members) {
		if (executiveIds.has(member.user_id)) {
			continue;
		}

		const department = getOperationalDepartment(member.department);
		if (!department) {
			continue;
		}

		const existingGroup = departments.get(department) ?? {
			department,
			teamLeads: [],
			members: [],
		};

		if (member.member_role === "Team Lead") {
			existingGroup.teamLeads.push(member);
		} else {
			existingGroup.members.push(member);
		}

		departments.set(department, existingGroup);
	}

	return {
		executives,
		boardMembers,
		departments: [...departments.values()]
			.map((group) => ({
				...group,
				teamLeads: [...group.teamLeads].sort(sortMembers),
				members: [...group.members].sort(sortMembers),
			}))
			.sort((left, right) => left.department.localeCompare(right.department)),
	};
}
