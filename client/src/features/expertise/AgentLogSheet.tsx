import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/apiClient";

interface AgentTraceToolCall {
	call_id: string;
	name: string;
	args: unknown;
	result: string;
	people: { user_id: string; name: string }[];
	ms: number;
}

interface AgentTraceRound {
	index: number;
	response_id: string;
	tool_calls: AgentTraceToolCall[];
	text: string;
}

interface AgentTrace {
	rounds: AgentTraceRound[];
	loadedPillars: string[];
	rawAnswer: string;
	finalAnswer: string;
	degraded: boolean;
}

interface AgentLogTurn {
	id: string;
	chat_id: string;
	turn_id: string;
	user_id: string | null;
	query: string;
	model: string | null;
	trace: AgentTrace;
	step_count: number;
	people_count: number;
	duration_ms: number | null;
	created_at: string;
}

function useAgentLog(chatId: string | null, enabled: boolean) {
	return useQuery({
		queryKey: ["beacon-agent-log", chatId],
		enabled: enabled && Boolean(chatId),
		queryFn: async () => {
			const res = (await apiClient(
				`/api/admin/beacon/agent-log?chat_id=${encodeURIComponent(chatId ?? "")}`,
				{ method: "GET" },
			)) as { turns: AgentLogTurn[] };
			return res.turns;
		},
	});
}

function downloadJson(filename: string, data: unknown): void {
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function pretty(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

interface AgentLogSheetProps {
	chatId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// Admin-only viewer for the full model trace of the current chat. Each turn
// shows the query, model + timing, every reasoning round and tool call (full
// args/results), and the final answer. Downloadable as raw JSON.
export function AgentLogSheet({
	chatId,
	open,
	onOpenChange,
}: AgentLogSheetProps): JSX.Element {
	const { data: turns, isLoading, error } = useAgentLog(chatId, open);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
			>
				<SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
					<SheetTitle className="text-sm">Model activity log</SheetTitle>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={!turns?.length}
						onClick={() =>
							turns && downloadJson(`beacon-chat-${chatId}.json`, turns)
						}
						className="gap-2"
					>
						<Download className="size-4" />
						Download JSON
					</Button>
				</SheetHeader>

				<div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 text-sm">
					{isLoading && <p className="text-muted-foreground">Loading trace…</p>}
					{error && (
						<p className="text-destructive">
							{error instanceof Error ? error.message : "Failed to load log."}
						</p>
					)}
					{turns && turns.length === 0 && (
						<p className="text-muted-foreground">
							No activity recorded for this chat yet.
						</p>
					)}
					{turns?.map((turn) => (
						<TurnView key={turn.id} turn={turn} />
					))}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function TurnView({ turn }: { turn: AgentLogTurn }): JSX.Element {
	return (
		<div className="space-y-3 rounded-lg border p-3">
			<div className="space-y-1">
				<p className="font-medium">{turn.query}</p>
				<p className="text-xs text-muted-foreground">
					{turn.model ?? "—"} · {turn.step_count} steps · {turn.people_count}{" "}
					people
					{turn.duration_ms != null && ` · ${turn.duration_ms} ms`}
					{turn.trace.degraded && " · degraded to fallback"}
				</p>
			</div>

			{turn.trace.rounds.map((round) => (
				<div key={round.response_id || round.index} className="space-y-2">
					{round.text && (
						<pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
							{round.text}
						</pre>
					)}
					{round.tool_calls.map((call) => (
						<details
							key={call.call_id}
							className="rounded-md border bg-card px-2 py-1.5"
						>
							<summary className="cursor-pointer text-xs font-medium">
								{call.name}
								<span className="ml-2 font-normal text-muted-foreground">
									{call.ms} ms
									{call.people.length > 0 && ` · ${call.people.length} people`}
								</span>
							</summary>
							<div className="mt-2 space-y-2 text-xs">
								<div>
									<p className="text-muted-foreground">args</p>
									<pre className="whitespace-pre-wrap break-all rounded bg-muted/50 p-2">
										{pretty(call.args)}
									</pre>
								</div>
								<div>
									<p className="text-muted-foreground">result</p>
									<pre className="whitespace-pre-wrap break-all rounded bg-muted/50 p-2">
										{call.result}
									</pre>
								</div>
							</div>
						</details>
					))}
				</div>
			))}

			{turn.trace.finalAnswer && (
				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">final answer</p>
					<pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
						{turn.trace.finalAnswer}
					</pre>
				</div>
			)}
		</div>
	);
}
