import { CardContent } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { cn } from "@/lib/utils";

function ProfileFieldSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("grid gap-1.5", className)}>
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-9 w-full rounded-md" />
		</div>
	);
}

function ProfileSectionSkeleton({ fields = 6 }: { fields?: number }) {
	return (
		<GlassCard variant="elevated">
			<CardContent className="p-6">
				<div className="mb-6 flex items-center gap-3">
					<Skeleton className="size-9 shrink-0 rounded-lg" />
					<div className="space-y-1.5">
						<Skeleton className="h-5 w-44" />
						<Skeleton className="h-4 w-56" />
					</div>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
					{Array.from({ length: fields }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<ProfileFieldSkeleton key={i} className="sm:col-span-6" />
					))}
				</div>
			</CardContent>
		</GlassCard>
	);
}

export function ProfilePageSkeleton() {
	return (
		<SkeletonRegion label="Loading profile">
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
				<aside className="flex flex-col gap-4 self-start lg:col-span-4">
					<GlassCard variant="elevated">
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<Skeleton className="size-16 shrink-0 rounded-full" />
								<div className="min-w-0 space-y-2">
									<Skeleton className="h-6 w-40" />
									<Skeleton className="h-4 w-28" />
								</div>
							</div>
							<Skeleton className="mt-4 h-7 w-32 rounded-full" />
							<div className="mt-5 space-y-1.5">
								<div className="flex items-center justify-between">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-8" />
								</div>
								<Skeleton className="h-2 w-full rounded-full" />
							</div>
							<div className="my-5 border-t border-border" />
							<Skeleton className="h-10 w-full rounded-md" />
						</CardContent>
					</GlassCard>

					<GlassCard variant="elevated" className="hidden lg:block">
						<CardContent className="p-4">
							<Skeleton className="mb-2 ml-2 h-3 w-24" />
							<div className="flex flex-col gap-1.5">
								{Array.from({ length: 5 }).map((_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
									<Skeleton key={i} className="ml-2 h-4 w-32" />
								))}
							</div>
						</CardContent>
					</GlassCard>

					<Skeleton className="hidden h-11 w-full rounded-md lg:block" />
				</aside>

				<div className="flex flex-col gap-6 lg:col-span-8">
					<ProfileSectionSkeleton fields={6} />
					<ProfileSectionSkeleton fields={4} />
				</div>
			</div>
		</SkeletonRegion>
	);
}
