import type { ExpertiseMatch } from "@member-manager/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE_QUESTIONS = [
	"Who knows machine learning?",
	"Find someone with backend experience",
	"Who has run hackathons?",
];

interface ExpertiseAskPanelProps {
	question: string;
	onQuestionChange: (value: string) => void;
	onSubmit: () => void;
	onClear: () => void;
	isPending: boolean;
	answer: string | null;
	source: "llm" | "fallback" | null;
	rankedMatches: ExpertiseMatch[];
	hasResult: boolean;
	nameByUserId: Map<string, string>;
	onSelectMatch: (userId: string) => void;
}

function initialsFromName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0]?.charAt(0) ?? "";
	const last =
		parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
	return (first + last).toUpperCase() || "?";
}

export function ExpertiseAskPanel({
	question,
	onQuestionChange,
	onSubmit,
	onClear,
	isPending,
	answer,
	source,
	rankedMatches,
	hasResult,
	nameByUserId,
	onSelectMatch,
}: ExpertiseAskPanelProps): React.ReactElement {
	return (
		<div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
			<div>
				<h2 className="text-sm font-semibold">Ask the graph</h2>
				<p className="text-xs text-muted-foreground">
					Ask about member expertise in plain language — matches light up on the
					graph.
				</p>
			</div>

			<Textarea
				value={question}
				onChange={(event) => onQuestionChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						onSubmit();
					}
				}}
				placeholder="e.g. Who has shipped an iOS app?"
				rows={3}
				aria-label="Ask about member expertise"
				disabled={isPending}
			/>

			<div className="flex items-center gap-2">
				<Button type="button" onClick={onSubmit} disabled={isPending}>
					{isPending && <Spinner className="mr-1" />}
					Ask
				</Button>
				{hasResult && (
					<Button
						type="button"
						variant="ghost"
						onClick={onClear}
						disabled={isPending}
					>
						Clear
					</Button>
				)}
			</div>

			{!hasResult && !isPending && (
				<div className="flex flex-wrap gap-1.5">
					{EXAMPLE_QUESTIONS.map((example) => (
						<button
							key={example}
							type="button"
							onClick={() => onQuestionChange(example)}
							className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{example}
						</button>
					))}
				</div>
			)}

			{answer && (
				<div className="rounded-lg border bg-background p-3">
					<Markdown>{answer}</Markdown>
					{source === "fallback" && (
						<p className="mt-2 text-xs text-muted-foreground">
							Keyword match (AI answering is not configured).
						</p>
					)}
				</div>
			)}

			{hasResult && (
				<div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
					{rankedMatches.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No matching members yet — expertise data is still being filled in.
						</p>
					) : (
						rankedMatches.map((match) => {
							const name = nameByUserId.get(match.userId) ?? "Unknown member";
							return (
								<button
									key={match.userId}
									type="button"
									onClick={() => onSelectMatch(match.userId)}
									className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									<Avatar size="sm">
										<AvatarFallback>{initialsFromName(name)}</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<span className="truncate text-sm font-semibold">
												{name}
											</span>
											<Badge variant="neutral">
												{Math.round(match.score * 100)}%
											</Badge>
										</div>
										<Progress
											className="mt-1 h-1.5"
											value={Math.round(match.score * 100)}
											aria-label={`Relevance ${Math.round(match.score * 100)}%`}
										/>
										{match.reason && (
											<p className="mt-1 truncate text-xs text-muted-foreground">
												{match.reason}
											</p>
										)}
									</div>
								</button>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
