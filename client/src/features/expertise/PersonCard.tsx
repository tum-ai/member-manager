import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "./ScoreRing";
import type { SearchPerson } from "./types";

function initialsOf(name: string): string {
	return (
		name
			.split(/\s+/)
			.map((s) => s.charAt(0))
			.join("")
			.slice(0, 2)
			.toUpperCase() || "?"
	);
}

interface PersonCardProps {
	person: SearchPerson;
	/** Relative match strength 0..1 (normalised within the result set). */
	strength: number;
	rank: number;
	delayMs?: number;
	onClick: () => void;
}

export function PersonCard({
	person,
	strength,
	rank,
	delayMs = 0,
	onClick,
}: PersonCardProps): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{ animationDelay: `${delayMs}ms` }}
			className="beacon-fade-up group relative flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--brand)_50%,transparent)]"
		>
			<ScoreRing value={strength} size={48}>
				<span className="inline-flex size-9 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
					{initialsOf(person.name)}
				</span>
			</ScoreRing>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium">{person.name}</span>
					{rank === 0 && (
						<Badge variant="brand" className="shrink-0 px-1.5 py-0 text-[10px]">
							Top match
						</Badge>
					)}
				</div>
				{person.match_reason && (
					<p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
						{person.match_reason}
					</p>
				)}
			</div>

			<ArrowUpRight className="size-4 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
		</button>
	);
}
