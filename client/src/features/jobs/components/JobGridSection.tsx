import { Briefcase } from "lucide-react";
import type React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import type { PartnerJob } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";
import { JobCard } from "./JobCard";

export function JobGridSection({
	jobs,
}: {
	jobs: PartnerJob[];
}): React.ReactElement {
	if (jobs.length === 0) {
		return (
			<GlassCard>
				<div className="p-6 md:p-8">
					<div className="flex flex-col items-start gap-3">
						<Briefcase className="size-6 text-brand" />
						<h2 className="text-xl font-semibold">No job postings right now</h2>
						<p className="text-muted-foreground">
							Approved opportunities will appear here.
						</p>
					</div>
				</div>
			</GlassCard>
		);
	}

	return (
		<div className={cn("grid grid-cols-1 gap-5 md:grid-cols-2")}>
			{jobs.map((job) => (
				<JobCard key={job.id} job={job} />
			))}
		</div>
	);
}

export function JobPostingsGridSkeleton(): React.ReactElement {
	return (
		<SkeletonRegion
			label="Loading job postings"
			className="grid grid-cols-1 gap-5 md:grid-cols-2"
		>
			{Array.from({ length: 4 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<GlassCard key={i} className="h-full">
					<div className="flex h-full flex-col gap-5 p-5 md:p-6">
						<div className="flex items-start gap-4">
							<Skeleton className="size-[52px] shrink-0 rounded-md" />
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-6 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						</div>
						<div className="flex gap-1.5">
							<Skeleton className="h-5 w-20 rounded-full" />
							<Skeleton className="h-5 w-24 rounded-full" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>
						<Separator />
						<div className="flex items-center justify-between gap-3">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-9 w-24 rounded-md" />
						</div>
					</div>
				</GlassCard>
			))}
		</SkeletonRegion>
	);
}
