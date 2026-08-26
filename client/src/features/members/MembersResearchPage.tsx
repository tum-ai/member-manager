import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { useMembersListData } from "@/hooks/useMembersListData";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { buildOrgChart } from "./orgChartUtils";
import {
	ProjectsEmptyState,
	ResearchProjectsSection,
	ResearchSkeleton,
} from "./projectSections";

export default function MembersResearchPage() {
	useSetPageHeader(
		"Research",
		"Active research projects and the members driving them.",
	);
	const { members, isLoading, error } = useMembersListData();
	const { researchProjects } = useResearchProjects();

	if (isLoading) {
		return <ResearchSkeleton />;
	}

	if (error) {
		return (
			<div className="py-16 text-center">
				<p className="text-destructive">
					Failed to load members. Please try again later.
				</p>
			</div>
		);
	}

	const chart = buildOrgChart(members ?? [], researchProjects ?? [], []);

	return (
		<div>
			{chart.researchProjects.length > 0 ? (
				<ResearchProjectsSection projects={chart.researchProjects} />
			) : (
				<ProjectsEmptyState label="research" />
			)}
		</div>
	);
}
