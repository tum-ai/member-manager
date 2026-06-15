import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useMembersListData } from "../../hooks/useMembersListData";
import OrgChartView from "./OrgChartView";

export default function MembersOrgChartPage() {
	const { members, isLoading, error } = useMembersListData();

	if (isLoading) {
		return <OrgChartSkeleton />;
	}

	if (error) {
		return (
			<div className="py-16 text-center">
				<p className="text-destructive">
					Failed to load members. Please try again later.
				</p>
			</div>
		);
	}

	return <OrgChartView members={members ?? []} />;
}

function MemberRowSkeleton() {
	return (
		<div className="flex items-center gap-2.5">
			<Skeleton className="size-8 shrink-0 rounded-full" />
			<Skeleton className="h-4 w-32" />
		</div>
	);
}

export function OrgChartSkeleton() {
	return (
		<SkeletonRegion label="Loading org chart">
			<div className="mb-6 space-y-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-[30rem] max-w-full" />
			</div>

			<div className="mb-8 rounded-xl border bg-card p-6">
				<Skeleton className="mb-5 h-5 w-20" />
				<div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, col) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<div key={col}>
							<Skeleton className="mb-2.5 h-3 w-24" />
							<div className="grid gap-3">
								{Array.from({ length: 2 }).map((_, row) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
									<MemberRowSkeleton key={row} />
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{Array.from({ length: 2 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						key={i}
						className="space-y-3 rounded-xl border bg-card p-5"
					>
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-4 w-full" />
						<MemberRowSkeleton />
						<MemberRowSkeleton />
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
