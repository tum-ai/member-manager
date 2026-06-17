import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";

export function AdminDatabaseSkeleton() {
	return (
		<SkeletonRegion label="Loading admin workspace">
			<GlassCard variant="elevated" className="mb-8 overflow-hidden">
				<div className="p-6 md:p-8">
					<div className="max-w-[680px] space-y-2.5">
						<Skeleton className="h-9 w-64" />
						<Skeleton className="h-4 w-[28rem] max-w-full" />
					</div>
					<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								key={i}
								className="flex items-center gap-3 rounded-lg border p-4"
							>
								<Skeleton className="size-10 shrink-0 rounded-lg" />
								<div className="space-y-1.5">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-6 w-12" />
								</div>
							</div>
						))}
					</div>
				</div>
			</GlassCard>

			<GlassCard variant="elevated" className="mb-6 overflow-hidden">
				<div className="flex items-center gap-6 border-b bg-muted/40 px-6 py-3">
					{Array.from({ length: 8 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<Skeleton key={i} className="h-4 flex-1" />
					))}
				</div>
				{Array.from({ length: 8 }).map((_, row) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						key={row}
						className="flex items-center gap-6 border-b px-6 py-4 last:border-b-0"
					>
						<div className="flex flex-1 items-center gap-3">
							<Skeleton className="size-9 shrink-0 rounded-full" />
							<Skeleton className="h-4 flex-1" />
						</div>
						{Array.from({ length: 6 }).map((_, col) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							<Skeleton key={col} className="h-4 flex-1" />
						))}
					</div>
				))}
			</GlassCard>
		</SkeletonRegion>
	);
}
