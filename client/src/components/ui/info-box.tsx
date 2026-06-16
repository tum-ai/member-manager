import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const infoBoxVariants = cva("rounded-lg border p-3", {
	variants: {
		variant: {
			muted: "border-border bg-muted/30",
			card: "border-border bg-card",
			brand: "border-brand/15 bg-brand/5",
			destructive: "border-destructive/30 bg-destructive/5",
		},
	},
	defaultVariants: {
		variant: "muted",
	},
});

/**
 * A bordered, tinted container for inline informational / status messages.
 * The `variant` only sets the border + background tint; text colour, padding
 * overrides and layout (e.g. `flex items-center gap-2`) stay per call site so
 * the box adapts to whatever it wraps.
 */
function InfoBox({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof infoBoxVariants>) {
	return (
		<div
			data-slot="info-box"
			className={cn(infoBoxVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { InfoBox, infoBoxVariants };
