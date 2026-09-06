import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	/** Brand-tinted leading icon. */
	icon?: LucideIcon;
	/** What's empty, named for the reader (not the system). */
	title: string;
	/** One line on how to fill it — an empty screen is an invitation to act. */
	description?: ReactNode;
	/** Primary call to action. */
	action?: ReactNode;
	className?: string;
}

/**
 * The single empty-state treatment. Replaces the three competing patterns
 * (plain centered text, an Alert, an icon+heading block) with one calm,
 * actionable card.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<GlassCard
			className={cn(
				"flex min-w-0 flex-col items-center gap-3 px-5 py-10 text-center sm:px-6 sm:py-14",
				className,
			)}
		>
			{Icon ? (
				<span className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
					<Icon className="size-6" aria-hidden />
				</span>
			) : null}
			<div className="space-y-1">
				<h3 className="font-semibold text-lg">{title}</h3>
				{description ? (
					<p className="mx-auto max-w-md text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
			</div>
			{action ? (
				<div className="mt-2 [&_[data-slot=button]]:min-h-11 sm:[&_[data-slot=button]]:min-h-9">
					{action}
				</div>
			) : null}
		</GlassCard>
	);
}
