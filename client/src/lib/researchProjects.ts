import type { ResearchProject } from "../types";

function normalizeResearchReference(value?: string | null): string {
	return value?.trim().toLowerCase() ?? "";
}

const UUID_REFERENCE_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_WITHOUT_DASHES_REFERENCE_PATTERN = /^[0-9a-f]{32}$/i;
const SANITY_REFERENCE_PATTERN = /^[a-z0-9]{16,}$/i;

export function isInternalResearchProjectReference(
	value?: string | null,
): boolean {
	const reference = value?.trim();
	if (!reference) return false;

	return (
		UUID_REFERENCE_PATTERN.test(reference) ||
		UUID_WITHOUT_DASHES_REFERENCE_PATTERN.test(reference) ||
		SANITY_REFERENCE_PATTERN.test(reference)
	);
}

export function getResearchProjectFallbackTitle(
	reference: string | null | undefined,
): string {
	const trimmed = reference?.trim();
	if (!trimmed || isInternalResearchProjectReference(trimmed)) {
		return "Unmatched Research Project";
	}

	return trimmed;
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
