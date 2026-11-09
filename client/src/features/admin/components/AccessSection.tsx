import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * One status group on /admin/mcp-access ("Waiting for approval (2)"): its
 * cards, or a line saying it's empty. The title names the region.
 */
export function AccessSection<T>({
	title,
	entries,
	emptyText,
	renderEntry,
}: {
	title: string;
	entries: T[];
	emptyText: string;
	renderEntry: (entry: T) => ReactNode;
}): JSX.Element {
	return (
		<section aria-label={title} className="space-y-3">
			<h2 className="text-lg font-semibold">
				{title} ({entries.length})
			</h2>
			{entries.length === 0 ? (
				<GlassCard className="p-6">
					<p className="text-muted-foreground">{emptyText}</p>
				</GlassCard>
			) : (
				<div className="grid items-start gap-4 lg:grid-cols-2">
					{entries.map(renderEntry)}
				</div>
			)}
		</section>
	);
}
