import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useInnovationProjects } from "../../hooks/useInnovationProjects";
import { useMembersListData } from "../../hooks/useMembersListData";
import { buildOrgChart } from "./orgChartUtils";
import {
	InnovationProjectsSection,
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
				<h1 className="text-2xl font-bold tracking-tight">Innovation</h1>
				<p className="mt-1 text-muted-foreground">
					Innovation initiatives and the members behind them.
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

function InnovationSkeleton() {
	return (
		<SkeletonRegion label="Loading innovation projects">
			<div className="mb-6 space-y-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-[32rem] max-w-full" />
			</div>

			<div className="flex flex-col gap-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						key={i}
						className="space-y-2 rounded-xl border bg-card px-5 py-4"
					>
						<Skeleton className="h-5 w-56" />
						<Skeleton className="h-4 w-40" />
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
