import { useInnovationProjects } from "@/hooks/useInnovationProjects";
import { useMembersListData } from "@/hooks/useMembersListData";
import { buildOrgChart } from "./orgChartUtils";
import {
	InnovationProjectsSection,
	InnovationSkeleton,
	ProjectsEmptyState,
} from "./projectSections";

export default function MembersInnovationPage() {
	const { members, isLoading, error } = useMembersListData();
	const { innovationProjects } = useInnovationProjects();

	if (isLoading) {
		return <InnovationSkeleton />;
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

	const chart = buildOrgChart(members ?? [], [], innovationProjects ?? []);

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">Task Forces</h1>
				<p className="mt-1 text-muted-foreground">
					Task forces and the members behind them.
				</p>
			</div>

			{chart.innovationProjects.length > 0 ? (
				<InnovationProjectsSection projects={chart.innovationProjects} />
			) : (
				<ProjectsEmptyState label="innovation" />
			)}
		</div>
	);
}
