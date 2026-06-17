import { Building2, ExternalLink, Mail, MapPin } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Markdown } from "@/components/ui/markdown";
import { Separator } from "@/components/ui/separator";
import {
	formatDate,
	getApplyHref,
	getApplyLabel,
	getSafeHttpUrl,
	jobTypeLabels,
} from "@/features/jobs/jobPostingsUtils";
import type { PartnerJob } from "@/hooks/useJobs";

function JobApplyButton({
	job,
	className,
}: {
	job: PartnerJob;
	className?: string;
}): React.ReactElement {
	const safeExternalUrl = getSafeHttpUrl(job.external_url);
	return (
		<Button
			asChild
			className={className}
			onClick={(event) => event.stopPropagation()}
		>
			<a
				href={getApplyHref(job)}
				target={safeExternalUrl ? "_blank" : undefined}
				rel={safeExternalUrl ? "noopener noreferrer" : undefined}
			>
				{getApplyLabel(job)}
				{safeExternalUrl ? (
					<ExternalLink className="size-4" />
				) : (
					<Mail className="size-4" />
				)}
			</a>
		</Button>
	);
}

function JobCardHeader({ job }: { job: PartnerJob }): React.ReactElement {
	const logoUrl = job.logo_url ?? job.partner.logo_url;
	return (
		<div className="flex items-start gap-4">
			<Avatar size="lg" className="size-[52px] rounded-md bg-brand/10">
				<AvatarImage src={logoUrl ?? undefined} alt={job.partner.name} />
				<AvatarFallback className="rounded-md bg-brand/10 text-brand">
					<Building2 className="size-5" />
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<h2 className="mb-0.5 text-xl font-semibold">{job.title}</h2>
				<p className="text-muted-foreground">{job.partner.name}</p>
			</div>
		</div>
	);
}

function JobBadges({ job }: { job: PartnerJob }): React.ReactElement {
	return (
		<div className="flex flex-wrap gap-2">
			<Badge variant="secondary">{jobTypeLabels[job.job_type]}</Badge>
			<Badge variant="outline" className="gap-1 text-muted-foreground">
				<MapPin className="size-3.5" />
				{job.location}
			</Badge>
		</div>
	);
}

function JobMeta({ job }: { job: PartnerJob }): React.ReactElement {
	return (
		<div>
			<p className="text-sm text-muted-foreground">
				Published {formatDate(job.published_at)}
			</p>
			<p className="text-sm text-muted-foreground">
				Contact: {job.contact.name}
				{job.contact.role ? `, ${job.contact.role}` : ""}
			</p>
		</div>
	);
}

function JobDetailDialog({
	job,
	open,
	onOpenChange,
}: {
	job: PartnerJob;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}): React.ReactElement {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] gap-5 overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<JobCardHeader job={job} />
				</DialogHeader>
				<JobBadges job={job} />
				<Markdown className="text-muted-foreground">
					{job.description_markdown}
				</Markdown>
				<Separator />
				<div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
					<JobMeta job={job} />
					<JobApplyButton job={job} className="self-stretch sm:self-center" />
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function JobCard({ job }: { job: PartnerJob }): React.ReactElement {
	const [detailOpen, setDetailOpen] = useState(false);

	return (
		<>
			<GlassCard variant="interactive" className="relative h-full">
				<div className="flex h-full flex-col gap-5 p-5 md:p-6">
					<JobCardHeader job={job} />
					<JobBadges job={job} />

					<div className="relative">
						<Markdown clampHeight="7.5rem" className="text-muted-foreground">
							{job.description_markdown}
						</Markdown>
						<button
							type="button"
							aria-label={`View details for ${job.title}`}
							onClick={() => setDetailOpen(true)}
							className="mt-1 inline-block text-sm font-medium text-brand after:absolute after:inset-0 after:content-['']"
						>
							Read more
						</button>
					</div>

					<div className="flex-1" />
					<Separator />

					<div className="flex flex-col items-stretch justify-between gap-1.5 sm:flex-row sm:items-center">
						<JobMeta job={job} />
						<div className="relative z-10 flex sm:contents">
							<JobApplyButton
								job={job}
								className="self-stretch sm:self-center"
							/>
						</div>
					</div>
				</div>
			</GlassCard>
			<JobDetailDialog
				job={job}
				open={detailOpen}
				onOpenChange={setDetailOpen}
			/>
		</>
	);
}
