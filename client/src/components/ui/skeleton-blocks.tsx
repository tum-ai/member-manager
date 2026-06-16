import { cn } from "@/lib/utils";

/**
 * One accessible loading region. Wrap a page's tailored skeleton in this so the
 * wait announces a single `role="status"` (avoid nesting these). The skeleton
 * markup inside should mirror the real content layout it stands in for.
 */
export function SkeletonRegion({
	label = "Loading",
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { label?: string }) {
	return (
		<div role="status" aria-label={label} className={cn(className)} {...props}>
			{children}
			<span className="sr-only">{label}</span>
		</div>
	);
}
