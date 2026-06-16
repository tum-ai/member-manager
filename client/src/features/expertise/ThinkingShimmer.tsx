// Initial "what it's doing" line, shown before any tool call has run. Matches
// ThinkingTrace's shimmer so progress looks identical throughout the turn.
export function ThinkingShimmer(): JSX.Element {
	return (
		<span className="beacon-shimmer-text text-[15px] font-medium">
			Searching…
		</span>
	);
}
