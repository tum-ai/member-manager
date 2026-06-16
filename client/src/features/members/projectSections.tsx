import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { OrgChartTeamCard, renderMembers } from "./orgChartShared";
import type {
	OrgChartInnovationProjectGroup,
	OrgChartResearchProjectGroup,
} from "./orgChartUtils";

export function ResearchProjectsSection({
	projects,
}: {
	projects: OrgChartResearchProjectGroup[];
}): JSX.Element {
	return (
		<section>
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="font-semibold">Research Projects</p>
				<Badge variant="outline">
					{`${projects.length} active project${projects.length !== 1 ? "s" : ""}`}
				</Badge>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{projects.map((project) => (
					<OrgChartTeamCard
						key={project.id}
						title={project.title}
						count={project.members.length + (project.leadSupervisor ? 1 : 0)}
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
	);
}

export function InnovationProjectsSection({
	projects,
}: {
	projects: OrgChartInnovationProjectGroup[];
}): JSX.Element {
	return (
		<section>
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="font-semibold">Innovation Projects</p>
				<Badge variant="outline">
					{`${projects.length} active project${projects.length !== 1 ? "s" : ""}`}
				</Badge>
			</div>
			<Accordion type="multiple" className="flex flex-col gap-3">
				{projects.map((project) => (
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
	);
}

export function ProjectsEmptyState({ label }: { label: string }): JSX.Element {
	return (
		<div className="rounded-xl border bg-card p-8 text-center">
			<p className="text-muted-foreground">{`No active ${label} projects yet.`}</p>
		</div>
	);
}

function ProjectsHeaderSkeleton(): JSX.Element {
	return (
		<div className="mb-6 space-y-2">
			<Skeleton className="h-8 w-36" />
			<Skeleton className="h-4 w-[32rem] max-w-full" />
		</div>
	);
}

export function ResearchSkeleton(): JSX.Element {
	return (
		<SkeletonRegion label="Loading research projects">
			<ProjectsHeaderSkeleton />
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

export function InnovationSkeleton(): JSX.Element {
	return (
		<SkeletonRegion label="Loading innovation projects">
			<ProjectsHeaderSkeleton />
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
