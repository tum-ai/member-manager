import type * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.ComponentProps<"div"> {
	variant?: "default" | "elevated" | "interactive";
	// Tolerated during the MUI→shadcn migration: not-yet-migrated call sites may
	// still pass an MUI `sx` prop. We drop it instead of leaking it to the DOM.
	sx?: unknown;
}

const variantClasses: Record<NonNullable<GlassCardProps["variant"]>, string> = {
	default: "shadow-sm",
	elevated: "shadow-md",
	interactive:
		"cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
};

// Clean, solid surface (the glassmorphism look was retired in the shadcn
// migration). Kept as a shim under the same import path + `variant` prop so the
// many consumers don't all need rewriting at once.
export function GlassCard({
	children,
	variant = "default",
	className,
	sx: _sx,
	...props
}: GlassCardProps) {
	return (
		<div
			data-slot="glass-card"
			className={cn(
				"rounded-xl border bg-card text-card-foreground",
				variantClasses[variant],
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
