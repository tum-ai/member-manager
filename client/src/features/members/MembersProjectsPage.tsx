import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useInnovationProjects } from "../../hooks/useInnovationProjects";
import { useMembersListData } from "../../hooks/useMembersListData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import ProjectsView from "./ProjectsView";

export default function MembersProjectsPage() {
	const { members, isLoading, error } = useMembersListData();
	const { researchProjects } = useResearchProjects();
	const { innovationProjects } = useInnovationProjects();

	if (isLoading) {
		return <ProjectsSkeleton />;
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

	return (
		<ProjectsView
			members={members ?? []}
			researchProjects={researchProjects ?? []}
			innovationProjects={innovationProjects ?? []}
		/>
	);
}

export function ProjectsSkeleton() {
	return (
		<SkeletonRegion label="Loading projects">
			<div className="mb-6 space-y-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-[32rem] max-w-full" />
			</div>

			<section className="mb-8">
				<Skeleton className="mb-3 h-5 w-44" />
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
			</section>

			<section>
				<Skeleton className="mb-3 h-5 w-44" />
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
			</section>
		</SkeletonRegion>
	);
}
