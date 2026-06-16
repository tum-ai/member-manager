import type { InnovationProject, Member, ResearchProject } from "../../types";
import { buildOrgChart } from "./orgChartUtils";
import {
	InnovationProjectsSection,
	ResearchProjectsSection,
} from "./projectSections";

interface ProjectsViewProps {
	members: Member[];
	researchProjects?: ResearchProject[];
	innovationProjects?: InnovationProject[];
}

export default function ProjectsView({
	members,
	researchProjects = [],
	innovationProjects = [],
}: ProjectsViewProps): JSX.Element {
	const chart = buildOrgChart(members, researchProjects, innovationProjects);
	const hasResearch = chart.researchProjects.length > 0;
	const hasInnovation = chart.innovationProjects.length > 0;

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">Projects</h1>
				<p className="mt-1 text-muted-foreground">
					Active research and innovation projects across TUM.ai.
				</p>
			</div>

			{!hasResearch && !hasInnovation && (
				<div className="rounded-xl border bg-card p-8 text-center">
					<p className="text-muted-foreground">No active projects yet.</p>
				</div>
			)}

			{hasResearch && (
				<div className="mb-8">
					<ResearchProjectsSection projects={chart.researchProjects} />
				</div>
			)}

			{hasInnovation && (
				<InnovationProjectsSection projects={chart.innovationProjects} />
			)}
		</div>
	);
}
