import type { ResearchProject } from "../types";

function normalizeResearchReference(value?: string | null): string {
	return value?.trim().toLowerCase() ?? "";
}

export function getResearchProjectReferences(
	project: ResearchProject,
): string[] {
	return [project.id, project.title, ...(project.aliases ?? [])].filter(
		(value): value is string => Boolean(value?.trim()),
	);
}

export function getResearchProjectSelectValue(
	value: string | null | undefined,
	projects: ResearchProject[],
): string {
	const normalizedValue = normalizeResearchReference(value);
	if (!normalizedValue) return "";

	const match = projects.find((project) =>
		getResearchProjectReferences(project).some(
			(reference) => normalizeResearchReference(reference) === normalizedValue,
		),
	);

	return match?.id ?? value ?? "";
}
