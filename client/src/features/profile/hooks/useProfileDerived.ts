import { useMemo } from "react";
import { resolveDepartmentForMemberRole } from "@/lib/memberMetadata";
import { getResearchProjectSelectValue } from "@/lib/researchProjects";
import type { ResearchProject } from "@/types";

const ACTIVE_RESEARCH_STATUSES = ["ongoing", "active", "in progress"];

interface ProfileDerivedInput {
	role: string;
	department: string;
	researchProjectId: string | null | undefined;
	researchProjects: ResearchProject[] | undefined;
}

/** Values the profile sections derive from the live form, kept out of the form hook. */
export function useProfileDerived({
	role,
	department,
	researchProjectId,
	researchProjects,
}: ProfileDerivedInput) {
	const currentRole = role || "Member";
	const effectiveDepartment = resolveDepartmentForMemberRole(
		currentRole,
		department,
	);

	const researchProjectOptions = useMemo(
		() =>
			(researchProjects ?? []).filter((project) => {
				const status = project.status?.trim().toLowerCase();
				return !status || ACTIVE_RESEARCH_STATUSES.includes(status);
			}),
		[researchProjects],
	);

	return {
		currentRole,
		currentDepartment: department,
		isResearchDepartmentSelected: effectiveDepartment === "Research",
		researchProjectOptions,
		researchProjectSelectValue: getResearchProjectSelectValue(
			researchProjectId,
			researchProjectOptions,
		),
	};
}
