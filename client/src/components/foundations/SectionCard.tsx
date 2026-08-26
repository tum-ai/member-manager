import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface SectionCardProps {
	/** Section heading (H2). */
	title?: ReactNode;
	/** Supporting line under the heading. */
	description?: ReactNode;
	/** Brand-tinted leading icon in the header. */
	icon?: LucideIcon;
	/** Right-aligned header actions. */
	actions?: ReactNode;
	variant?: "default" | "elevated";
	className?: string;
	/** Override padding/layout of the content region. */
	contentClassName?: string;
	children: ReactNode;
}

/**
 * A titled content card — the standard section container. Promotes the tools
 * feature's icon-circle + heading + body composition so every section header
 * looks the same.
 */
export function SectionCard({
	title,
	description,
	icon: Icon,
	actions,
	variant = "default",
	className,
	contentClassName,
	children,
}: SectionCardProps) {
	const hasHeader = Boolean(title || description || actions || Icon);
	const headingId = useId();
	return (
		<GlassCard
			variant={variant}
			role={title ? "region" : undefined}
			aria-labelledby={title ? headingId : undefined}
			className={cn("min-w-0 overflow-hidden", className)}
		>
			{hasHeader ? (
				<div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
					<div className="flex min-w-0 items-start gap-3">
						{Icon ? (
							<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
								<Icon className="size-5" aria-hidden />
							</span>
						) : null}
						<div className="space-y-1">
							{title ? (
								<h2
									id={headingId}
									className="font-semibold text-lg leading-tight"
								>
									{title}
								</h2>
							) : null}
							{description ? (
								<p className="text-muted-foreground text-sm">{description}</p>
							) : null}
						</div>
					</div>
					{actions ? (
						<div className="flex flex-wrap items-center gap-2 [&_[data-slot=button]]:min-h-11 sm:shrink-0 sm:[&_[data-slot=button]]:min-h-9">
							{actions}
						</div>
					) : null}
				</div>
			) : null}
			<div className={cn("p-5 sm:p-6", contentClassName)}>{children}</div>
		</GlassCard>
	);
}
