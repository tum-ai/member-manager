import type { AgentStep } from "./types";

// Live activity line while the agent works: a single shimmering "Searching…"
// (deliberately generic — never leaks the raw query) plus a subtle count of how
// many tool calls have run so far.
export function ThinkingTrace({ steps }: { steps: AgentStep[] }): JSX.Element {
	const calls = steps.length;

	return (
		<div className="flex items-center gap-2">
			<span className="beacon-shimmer-text text-[15px] font-medium">
				Searching…
			</span>
			{calls > 0 && (
				<span className="text-xs tabular-nums text-muted-foreground/50">
					{calls} {calls === 1 ? "call" : "calls"}
				</span>
			)}
		</div>
	);
}
