import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { InnovationProject, Member, ResearchProject } from "../../types";
import { OrgChartTeamCard, renderMembers } from "./orgChartShared";
import { buildOrgChart } from "./orgChartUtils";

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
				<section className="mb-8">
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="font-semibold">Research Projects</p>
						<Badge variant="outline">
							{`${chart.researchProjects.length} active project${chart.researchProjects.length !== 1 ? "s" : ""}`}
						</Badge>
					</div>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{chart.researchProjects.map((project) => (
							<OrgChartTeamCard
								key={project.id}
								title={project.title}
								count={
									project.members.length + (project.leadSupervisor ? 1 : 0)
								}
								description={project.description}
								badges={
									project.status ? (
										<Badge variant="outline" className="text-brand">
											{project.status}
										</Badge>
									) : undefined
								}
								primaryLabel="Lead Supervisor"
								primaryMembers={
									project.leadSupervisor ? [project.leadSupervisor] : []
								}
								primaryEmpty="Not assigned in member manager yet."
								secondaryLabel="Project Members"
								secondaryMembers={project.members}
								secondaryEmpty="No project members assigned yet."
							/>
						))}
					</div>
				</section>
			)}

			{hasInnovation && (
				<section>
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="font-semibold">Innovation Projects</p>
						<Badge variant="outline">
							{`${chart.innovationProjects.length} active project${chart.innovationProjects.length !== 1 ? "s" : ""}`}
						</Badge>
					</div>
					<Accordion type="multiple" className="flex flex-col gap-3">
						{chart.innovationProjects.map((project) => (
							<AccordionItem
								key={project.id}
								value={project.id}
								// Each project is a standalone card; cancel the base
								// accordion's `last:border-b-0` so the last card keeps a
								// complete outline (visible in light mode).
								className="rounded-xl border bg-card px-5 last:border-b"
							>
								<AccordionTrigger className="py-4 hover:no-underline">
									<div className="pr-1 text-left">
										<p className="font-semibold">{project.title}</p>
										<p className="text-sm font-normal text-muted-foreground">
											{project.description}
										</p>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pt-0 pb-5">
									{project.detailedDescription && (
										<p className="mb-4 text-sm text-muted-foreground">
											{project.detailedDescription}
										</p>
									)}

									<p className="mb-2.5 text-xs font-medium text-muted-foreground">
										Project Leads
									</p>
									<div className="mb-5 grid gap-3">
										{project.leads.length > 0 ? (
											renderMembers(project.leads, { lead: true })
										) : (
											<p className="text-sm text-muted-foreground">
												No project lead assigned yet.
											</p>
										)}
									</div>

									<p className="mb-2.5 text-xs font-medium text-muted-foreground">
										Project Members
									</p>
									<div className="grid gap-3">
										{project.members.length > 0 ? (
											renderMembers(project.members)
										) : (
											<p className="text-sm text-muted-foreground">
												No project members assigned yet.
											</p>
										)}
									</div>
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</section>
			)}
		</div>
	);
}
