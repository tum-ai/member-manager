import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useMembersListData } from "../../hooks/useMembersListData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import { buildOrgChart } from "./orgChartUtils";
import { ProjectsEmptyState, ResearchProjectsSection } from "./projectSections";

export default function MembersResearchPage() {
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
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">Research</h1>
				<p className="mt-1 text-muted-foreground">
					Active research projects and the members driving them.
				</p>
			</div>

			{chart.researchProjects.length > 0 ? (
				<ResearchProjectsSection projects={chart.researchProjects} />
			) : (
				<ProjectsEmptyState label="research" />
			)}
		</div>
	);
}

function ResearchSkeleton() {
	return (
		<SkeletonRegion label="Loading research projects">
			<div className="mb-6 space-y-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-[32rem] max-w-full" />
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{Array.from({ length: 2 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						key={i}
						className="space-y-3 rounded-xl border bg-card p-5"
					>
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-4/5" />
						<div className="flex items-center gap-2.5 pt-2">
							<Skeleton className="size-8 shrink-0 rounded-full" />
							<Skeleton className="h-4 w-32" />
						</div>
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
