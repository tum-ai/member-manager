import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";

export function TemplateListSkeleton() {
	return (
		<SkeletonRegion
			label="Loading templates"
			className="flex flex-col gap-0.5 p-4"
		>
			{Array.from({ length: 6 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<div key={i} className="flex items-center gap-2 px-3 py-2">
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-12" />
					</div>
					<Skeleton className="size-8 shrink-0 rounded-md" />
				</div>
			))}
		</SkeletonRegion>
	);
}

export function TemplateEditorSkeleton() {
	return (
		<SkeletonRegion label="Loading template" className="flex flex-col gap-6">
			<GlassCard className="p-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-9 w-full rounded-md" />
					</div>
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-16 w-full rounded-md" />
					</div>
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-48 w-full rounded-md" />
					</div>
					<Skeleton className="h-5 w-56" />
					<div className="flex flex-row gap-2">
						<Skeleton className="h-9 w-20 rounded-md" />
						<Skeleton className="h-9 w-20 rounded-md" />
					</div>
				</div>
			</GlassCard>
		</SkeletonRegion>
	);
}
