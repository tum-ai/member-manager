import type { ReactNode } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/spinner";

interface AdminRequestsLayoutProps {
	title: string;
	description: string;
	isLoading?: boolean;
	error?: Error | null;
	children: ReactNode;
}

export default function AdminRequestsLayout({
	title,
	description,
	isLoading = false,
	error = null,
	children,
}: AdminRequestsLayoutProps) {
	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				<p className="mt-1 text-muted-foreground">{description}</p>
			</div>

			{isLoading ? (
				<GlassCard variant="elevated">
					<div className="flex items-center justify-center gap-4 p-8">
						<Spinner className="size-6" />
						<span className="text-muted-foreground">Loading requests...</span>
					</div>
				</GlassCard>
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
