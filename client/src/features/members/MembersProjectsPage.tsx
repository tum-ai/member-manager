import { Spinner } from "@/components/ui/spinner";
import { useInnovationProjects } from "../../hooks/useInnovationProjects";
import { useMembersListData } from "../../hooks/useMembersListData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import ProjectsView from "./ProjectsView";

export default function MembersProjectsPage() {
	const { members, isLoading, error } = useMembersListData();
	const { researchProjects } = useResearchProjects();
	const { innovationProjects } = useInnovationProjects();

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center gap-4">
				<Spinner className="size-6" />
				<p className="text-muted-foreground">Loading projects...</p>
			</div>
		);
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
