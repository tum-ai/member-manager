import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import {
	PageHeaderActions,
	useSetPageHeader,
} from "@/contexts/PageHeaderContext";

interface AdminRequestsLayoutProps {
	title: string;
	description: string;
	actions?: ReactNode;
	isLoading?: boolean;
	error?: Error | null;
	children: ReactNode;
}

export function AdminRequestsLayout({
	title,
	description,
	actions,
	isLoading = false,
	error = null,
	children,
}: AdminRequestsLayoutProps) {
	useSetPageHeader(title, description);
	return (
		<div>
			{actions ? <PageHeaderActions>{actions}</PageHeaderActions> : null}
			{isLoading ? (
				<SkeletonRegion
					label="Loading requests"
					className="grid items-start gap-4 lg:grid-cols-2"
				>
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<GlassCard key={i} className="flex flex-col p-5">
							<Skeleton className="mb-2 h-5 w-1/2" />
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="mt-0.5 h-4 w-1/3" />
							<Skeleton className="mt-2 h-4 w-3/4" />
							<div className="mt-auto flex gap-3 pt-4">
								<Skeleton className="h-9 w-24 rounded-md" />
								<Skeleton className="h-9 w-24 rounded-md" />
							</div>
						</GlassCard>
					))}
				</SkeletonRegion>
			) : error ? (
				<GlassCard variant="elevated">
					<div className="p-8 text-center">
						<p className="mb-1 font-bold text-destructive">
							Unable to load requests
						</p>
						<p className="text-muted-foreground">{error.message}</p>
					</div>
				</GlassCard>
			) : (
				children
			)}
		</div>
	);
}
