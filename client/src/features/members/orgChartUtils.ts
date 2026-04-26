import type { InnovationProject, Member, ResearchProject } from "../../types";

export interface OrgChartDepartmentGroup {
	department: string;
	teamLeads: Member[];
	members: Member[];
}

export interface OrgChartBoardGroup {
	presidents: Member[];
	vicePresidents: Member[];
	members: Member[];
}

export interface OrgChartResearchProjectGroup {
	id: string;
	title: string;
	description?: string;
	status?: string;
	leadSupervisor?: Member;
	members: Member[];
}

export interface OrgChartInnovationProjectGroup {
	id: string;
	title: string;
	description: string;
	detailedDescription: string;
	image?: string;
	leads: Member[];
	members: Member[];
}

export interface OrgChartData {
	board: OrgChartBoardGroup;
	departments: OrgChartDepartmentGroup[];
	researchProjects: OrgChartResearchProjectGroup[];
	innovationProjects: OrgChartInnovationProjectGroup[];
}

function getMemberDisplayName(member: Member): string {
	return `${member.given_name} ${member.surname}`.trim();
}

function sortMembers(left: Member, right: Member): number {
	return getMemberDisplayName(left).localeCompare(getMemberDisplayName(right));
}

function normalize(value?: string | null): string {
	return value?.trim().toLowerCase() ?? "";
}

function readMemberText(member: Member, keys: string[]): string {
	for (const key of keys) {
		const value = member[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
}

function getBoardRole(member: Member): keyof OrgChartBoardGroup | null {
	if (member.member_role === "President") {
		return "presidents";
	}
	if (member.member_role === "Vice-President") {
		return "vicePresidents";
	}

	const explicitBoardRole = normalize(
		readMemberText(member, ["board_role", "boardRole", "board_position"]),
	);
	if (explicitBoardRole.includes("president")) {
		return explicitBoardRole.includes("vice") ? "vicePresidents" : "presidents";
	}
	if (explicitBoardRole) {
		return "members";
	}

	return member.department?.trim() === "Board" ? "members" : null;
}

function isResearchProjectActive(project: ResearchProject): boolean {
	const status = normalize(project.status);
	return (
		status === "ongoing" || status === "active" || status === "in progress"
	);
}

function getResearchProjectReference(member: Member): string {
	return readMemberText(member, [
		"research_project_id",
		"researchProjectId",
		"research_project",
		"researchProject",
		"research_project_title",
		"researchProjectTitle",
	]);
}

function getInnovationProjectReference(member: Member): string {
	return readMemberText(member, [
		"innovation_project_id",
		"innovationProjectId",
		"innovation_project",
		"innovationProject",
		"innovation_project_title",
		"innovationProjectTitle",
	]);
}

function isInnovationProjectLead(member: Member): boolean {
	const role = normalize(
		readMemberText(member, [
			"innovation_project_role",
			"innovationProjectRole",
			"innovation_role",
			"innovationRole",
		]),
	);
	return role.includes("lead");
}

function createResearchProjectGroup(
	project: Pick<ResearchProject, "id" | "title" | "description" | "status">,
): OrgChartResearchProjectGroup {
	return {
		id: project.id,
		title: project.title.trim(),
		description: project.description,
		status: project.status,
		members: [],
	};
}

function createInnovationProjectGroup(
	project: InnovationProject,
): OrgChartInnovationProjectGroup {
	return {
		id: project.id,
		title: project.title.trim(),
		description: project.description.trim(),
		detailedDescription: project.detailedDescription.trim(),
		image: project.image,
		leads: [],
		members: [],
	};
}

function getResearchGroupForMember(
	member: Member,
	researchGroups: Map<string, OrgChartResearchProjectGroup>,
	researchGroupsByReference: Map<string, OrgChartResearchProjectGroup>,
): OrgChartResearchProjectGroup {
	const reference = getResearchProjectReference(member);
	const existingGroup = reference
		? researchGroupsByReference.get(normalize(reference))
		: undefined;
	if (existingGroup) {
		return existingGroup;
	}

	const fallbackId = reference
		? `custom:${normalize(reference)}`
		: "unassigned";
	const fallbackTitle = reference || "Unassigned Research";
	const fallbackGroup =
		researchGroups.get(fallbackId) ??
		createResearchProjectGroup({
			id: fallbackId,
			title: fallbackTitle,
			status: reference ? "ongoing" : undefined,
		});
	researchGroups.set(fallbackId, fallbackGroup);
	if (reference) {
		researchGroupsByReference.set(normalize(reference), fallbackGroup);
	}
	return fallbackGroup;
}

function getInnovationGroupForMember(
	member: Member,
	innovationGroups: Map<string, OrgChartInnovationProjectGroup>,
	innovationGroupsByReference: Map<string, OrgChartInnovationProjectGroup>,
): OrgChartInnovationProjectGroup | undefined {
	const reference = getInnovationProjectReference(member);
	if (!reference) {
		return undefined;
	}

	const existingGroup = innovationGroupsByReference.get(normalize(reference));
	if (existingGroup) {
		return existingGroup;
	}

	const fallbackId = `custom:${normalize(reference)}`;
	const fallbackGroup =
		innovationGroups.get(fallbackId) ??
		({
			id: fallbackId,
			title: reference,
			description: "",
			detailedDescription: "",
			leads: [],
			members: [],
		} satisfies OrgChartInnovationProjectGroup);
	innovationGroups.set(fallbackId, fallbackGroup);
	innovationGroupsByReference.set(normalize(reference), fallbackGroup);
	return fallbackGroup;
}

export function buildOrgChart(
	members: Member[],
	researchProjects: ResearchProject[] = [],
	innovationProjects: InnovationProject[] = [],
): OrgChartData {
	const board: OrgChartBoardGroup = {
		presidents: [],
		vicePresidents: [],
		members: [],
	};

	const departments = new Map<string, OrgChartDepartmentGroup>();
	const researchGroups = new Map<string, OrgChartResearchProjectGroup>();
	const researchGroupsByReference = new Map<
		string,
		OrgChartResearchProjectGroup
	>();
	const innovationGroups = new Map<string, OrgChartInnovationProjectGroup>();
	const innovationGroupsByReference = new Map<
		string,
		OrgChartInnovationProjectGroup
	>();

	for (const project of researchProjects.filter(isResearchProjectActive)) {
		const title = project.title.trim();
		if (!title || title === "Untitled") {
			continue;
		}
		const group = createResearchProjectGroup(project);
		researchGroups.set(project.id, group);
		researchGroupsByReference.set(normalize(project.id), group);
		researchGroupsByReference.set(normalize(title), group);
	}

	for (const project of innovationProjects) {
		const title = project.title.trim();
		if (!title) {
			continue;
		}
		const group = createInnovationProjectGroup(project);
		innovationGroups.set(project.id, group);
		innovationGroupsByReference.set(normalize(project.id), group);
		innovationGroupsByReference.set(normalize(title), group);
	}

	for (const member of members) {
		const boardRole = getBoardRole(member);
		if (boardRole) {
			board[boardRole].push(member);
		}

		const department = member.department?.trim();
		const researchReference = getResearchProjectReference(member);
		const isResearchMember =
			department === "Research" || Boolean(researchReference);
		if (isResearchMember) {
			const researchGroup = getResearchGroupForMember(
				member,
				researchGroups,
				researchGroupsByReference,
			);
			if (member.member_role === "Team Lead" && !researchGroup.leadSupervisor) {
				researchGroup.leadSupervisor = member;
			} else {
				researchGroup.members.push(member);
			}
		}

		const innovationGroup = getInnovationGroupForMember(
			member,
			innovationGroups,
			innovationGroupsByReference,
		);
		if (innovationGroup) {
			if (isInnovationProjectLead(member)) {
				innovationGroup.leads.push(member);
			} else {
				innovationGroup.members.push(member);
			}
		}

		if (!department || department === "Board" || department === "Research") {
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
		board: {
			presidents: [...board.presidents].sort(sortMembers),
			vicePresidents: [...board.vicePresidents].sort(sortMembers),
			members: [...board.members].sort(sortMembers),
		},
		departments: [...departments.values()]
			.map((group) => ({
				...group,
				teamLeads: [...group.teamLeads].sort(sortMembers),
				members: [...group.members].sort(sortMembers),
			}))
			.sort((left, right) => left.department.localeCompare(right.department)),
		researchProjects: [...researchGroups.values()]
			.map((group) => ({
				...group,
				members: [...group.members].sort(sortMembers),
			}))
			.sort((left, right) => {
				if (left.id === "unassigned") return 1;
				if (right.id === "unassigned") return -1;
				return left.title.localeCompare(right.title);
			}),
		innovationProjects: [...innovationGroups.values()]
			.map((group) => ({
				...group,
				leads: [...group.leads].sort(sortMembers),
				members: [...group.members].sort(sortMembers),
			}))
			.sort((left, right) => left.title.localeCompare(right.title)),
	};
}
