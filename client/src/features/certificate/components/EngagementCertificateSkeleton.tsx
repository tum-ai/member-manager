import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { ToolPageShell } from "@/features/tools/ToolPageShell";

export function EngagementCertificateSkeleton(): JSX.Element {
	return (
		<ToolPageShell
			title="Engagement Certificate"
			description="Submit engagement details for admin review."
		>
			<SkeletonRegion label="Loading engagement certificate">
				<GlassCard className="mb-6">
					<div className="space-y-3 p-6">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-11/12" />
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="mt-2 h-16 w-full rounded-md" />
					</div>
				</GlassCard>
				<GlassCard className="mb-6">
					<div className="p-6">
						<Skeleton className="mb-4 h-6 w-40" />
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{Array.from({ length: 4 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								<div key={i} className="space-y-2">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-9 w-full rounded-md" />
								</div>
							))}
						</div>
					</div>
				</GlassCard>
				<Skeleton className="h-10 w-44 rounded-md" />
			</SkeletonRegion>
		</ToolPageShell>
	);
}
