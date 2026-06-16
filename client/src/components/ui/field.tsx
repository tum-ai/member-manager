import type * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps extends React.ComponentProps<"div"> {
	label?: React.ReactNode;
	htmlFor?: string;
	required?: boolean;
	description?: React.ReactNode;
	error?: React.ReactNode;
}

function Field({
	label,
	htmlFor,
	required,
	description,
	error,
	className,
	children,
	...props
}: FieldProps) {
	return (
		<div data-slot="field" className={cn("grid gap-1.5", className)} {...props}>
			{label != null && (
				<Label htmlFor={htmlFor}>
					{label}
					{required && " *"}
				</Label>
			)}
			{children}
			{description != null && (
				<p className="text-xs text-muted-foreground">{description}</p>
			)}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}

export type { FieldProps };
export { Field };
