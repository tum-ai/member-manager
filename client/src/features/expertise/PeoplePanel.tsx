import { Users, X } from "lucide-react";
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

interface PeoplePanelProps {
	people: SearchPerson[];
	onOpen: (userId: string, name: string) => void;
	onClose: () => void;
}

// Right-hand list of everyone referenced across the conversation. Collapsed by
// default; opened from the top-right control. Clicking a row opens the profile.
export function PeoplePanel({
	people,
	onOpen,
	onClose,
}: PeoplePanelProps): JSX.Element {
	return (
		<aside className="hidden w-72 shrink-0 flex-col border-l lg:flex">
			<div className="flex items-center justify-between border-b px-4 py-3.5">
				<h2 className="flex items-center gap-2 text-sm font-semibold">
					<Users className="size-4 text-muted-foreground" />
					People
					<span className="font-normal text-muted-foreground">
						· {people.length}
					</span>
				</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label="Hide people"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			</div>
			<div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
				{people.map((p, i) => (
					<button
						key={p.user_id}
						type="button"
						onClick={() => onOpen(p.user_id, p.name)}
						style={{ animationDelay: `${i * 35}ms` }}
						className="beacon-fade-up flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
					>
						<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
							{initialsOf(p.name)}
						</span>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">{p.name}</p>
							{p.match_reason && (
								<p className="truncate text-xs text-muted-foreground">
									{p.match_reason}
								</p>
							)}
						</div>
					</button>
				))}
			</div>
		</aside>
	);
}
