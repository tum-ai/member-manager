import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { ToolPageShell } from "@/features/tools/ToolPageShell";

export function ContractSubmissionDetailSkeleton(): JSX.Element {
	return (
		<ToolPageShell
			title="Submission"
			description="Review, edit and progress this contract through the workflow."
		>
			<SkeletonRegion label="Loading submission">
				<div className="mb-6 flex items-center gap-2">
					<Skeleton className="h-4 w-12" />
					<Skeleton className="h-5 w-24 rounded-full" />
				</div>

				<div className="flex flex-col gap-6">
					<GlassCard className="p-6">
						<Skeleton className="mb-3 h-5 w-24" />
						<dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
							{Array.from({ length: 6 }).map((_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								<div key={index} className="flex items-start gap-3">
									<Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
									<div className="min-w-0 flex-1 space-y-1.5">
										<Skeleton className="h-3 w-24" />
										<Skeleton className="h-4 w-3/4" />
									</div>
								</div>
							))}
						</dl>
					</GlassCard>

					<GlassCard className="p-6">
						<Skeleton className="mb-3 h-5 w-32" />
						<Skeleton className="mx-auto aspect-[1/1.414] w-full max-w-[595px] rounded-md" />
					</GlassCard>
				</div>
			</SkeletonRegion>
		</ToolPageShell>
	);
}
