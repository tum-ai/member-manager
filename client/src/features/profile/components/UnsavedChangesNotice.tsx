import { cn } from "@/lib/utils";

interface UnsavedChangesNoticeProps {
	/** Say that the completeness percentage counts the unsaved values too. */
	explainCompleteness?: boolean;
	className?: string;
}

/**
 * Tells the member that the form holds values the server does not have yet.
 * Rendered only while the profile is dirty; `role="status"` announces it when
 * it appears.
 */
export function UnsavedChangesNotice({
	explainCompleteness = false,
	className,
}: UnsavedChangesNoticeProps): JSX.Element {
	return (
		<p
			role="status"
			className={cn(
				"flex items-start gap-2 text-xs text-muted-foreground",
				className,
			)}
		>
			<span
				aria-hidden="true"
				className="mt-1 size-2 shrink-0 rounded-full bg-brand"
			/>
			<span>
				<span className="font-medium text-foreground">Unsaved changes</span>
				{explainCompleteness
					? " · the percentage above includes them. Save to keep them."
					: " · save to keep them."}
			</span>
		</p>
	);
}
