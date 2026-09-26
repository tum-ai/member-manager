import type React from "react";
import { cn } from "@/lib/utils";

/** Titled column of `Detail` rows, shared by the review queue and the member detail dialog. */
export function DetailGroup({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="grid min-w-0 content-start gap-2">
			<p className="text-sm font-extrabold">{title}</p>
			{children}
		</div>
	);
}

/** Label/value pair for read-only reimbursement fields. */
export function Detail({
	label,
	value,
	strong = false,
	monospace = false,
}: {
	label: string;
	value: string;
	strong?: boolean;
	monospace?: boolean;
}): React.ReactElement {
	return (
		<div>
			<span className="text-xs text-muted-foreground">{label}</span>
			<p
				className={cn(
					"text-sm break-words",
					strong ? "font-bold" : "font-medium",
					monospace && "font-mono",
				)}
			>
				{value}
			</p>
		</div>
	);
}
