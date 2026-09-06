import {
	agentTraceTruncatedMarkerSchema,
	type SanitizedAgentTrace,
	sanitizedAgentTraceSchema,
} from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/apiClient";
import { expertiseQueryKeys } from "./expertiseQueryKeys";

const agentLogTurnSchema = z.object({
	id: z.string(),
	chat_id: z.string(),
	turn_id: z.string(),
	user_id: z.string().nullable(),
	query: z.string(),
	model: z.string().nullable(),
	trace: sanitizedAgentTraceSchema,
	step_count: z.number(),
	people_count: z.number(),
	duration_ms: z.number().nullable(),
	created_at: z.string(),
});

type AgentLogTurn = z.infer<typeof agentLogTurnSchema>;

// The persistence contract deliberately permits any bounded JSON value. This
// optional projection renders the current AgentTrace shape without rejecting
// older or more aggressively sanitized rows.
const displayTraceSchema = z.object({
	rounds: z
		.array(
			z.object({
				index: z.number().optional(),
				response_id: z.string().optional(),
				tool_calls: z
					.array(
						z.object({
							call_id: z.string().optional(),
							name: z.string(),
							args: sanitizedAgentTraceSchema.optional(),
							people: z
								.array(z.object({ user_id: z.string(), name: z.string() }))
								.optional()
								.default([]),
							ms: z.number().optional(),
						}),
					)
					.optional()
					.default([]),
				text: z.string().optional(),
			}),
		)
		.optional()
		.default([]),
	finalAnswer: z.string().optional(),
	degraded: z.boolean().optional().default(false),
});

function useAgentLog(chatId: string | null, enabled: boolean) {
	return useQuery({
		queryKey: expertiseQueryKeys.agentLog(chatId),
		enabled: enabled && Boolean(chatId),
		queryFn: async () => {
			const response = await apiClient<unknown>(
				`/api/admin/beacon/agent-log?chat_id=${encodeURIComponent(chatId ?? "")}`,
				{ method: "GET" },
			);
			return z.object({ turns: z.array(agentLogTurnSchema) }).parse(response)
				.turns;
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
					<div>
						<SheetTitle className="text-sm">Model activity log</SheetTitle>
						<SheetDescription className="sr-only">
							Sanitized model and tool activity for this Beacon chat.
						</SheetDescription>
					</div>
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
	const trace = displayTraceSchema.safeParse(turn.trace);
	return (
		<div className="space-y-3 rounded-lg border p-3">
			<div className="space-y-1">
				<p className="font-medium">{turn.query}</p>
				<p className="text-xs text-muted-foreground">
					{turn.model ?? "—"} · {turn.step_count} steps · {turn.people_count}{" "}
					people
					{turn.duration_ms != null && ` · ${turn.duration_ms} ms`}
					{trace.success && trace.data.degraded && " · degraded to fallback"}
				</p>
			</div>
			<TraceView trace={turn.trace} />
		</div>
	);
}

function TraceView({ trace }: { trace: SanitizedAgentTrace }): JSX.Element {
	const truncated = agentTraceTruncatedMarkerSchema.safeParse(trace);
	if (truncated.success) {
		return (
			<div className="rounded-lg bg-brand/10 p-3 text-xs" role="status">
				<p className="font-medium">Trace details were not stored</p>
				<p className="mt-1 text-muted-foreground">
					The sanitized trace exceeded the persistence limit.
				</p>
			</div>
		);
	}

	const parsed = displayTraceSchema.safeParse(trace);
	if (!parsed.success) {
		return (
			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">
					No structured trace details were retained.
				</p>
				<pre className="whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 text-xs">
					{pretty(trace)}
				</pre>
			</div>
		);
	}

	const { rounds, finalAnswer } = parsed.data;
	if (!rounds.length && !finalAnswer) {
		return (
			<p className="text-xs text-muted-foreground">
				No structured trace details were retained.
			</p>
		);
	}

	return (
		<>
			{rounds.map((round) => (
				<div
					key={round.response_id ?? String(round.index ?? pretty(round))}
					className="space-y-2"
				>
					{round.text ? (
						<pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
							{round.text}
						</pre>
					) : null}
					{round.tool_calls.map((call) => (
						<details
							key={call.call_id ?? `${call.name}:${pretty(call.args)}`}
							className="rounded-md border bg-card px-2 py-1.5"
						>
							<summary className="cursor-pointer text-xs font-medium">
								{call.name}
								<span className="ml-2 font-normal text-muted-foreground">
									{call.ms !== undefined ? `${call.ms} ms` : "timing omitted"}
									{call.people.length > 0
										? ` · ${call.people.length} people`
										: ""}
								</span>
							</summary>
							<div className="mt-2 space-y-2 text-xs">
								<div>
									<p className="text-muted-foreground">args</p>
									<pre className="whitespace-pre-wrap break-all rounded bg-muted/50 p-2">
										{call.args === undefined
											? "No persisted arguments."
											: pretty(call.args)}
									</pre>
								</div>
								<p className="text-muted-foreground">
									Tool result omitted from the stored trace.
								</p>
							</div>
						</details>
					))}
				</div>
			))}
			{finalAnswer ? (
				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">final answer</p>
					<pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
						{finalAnswer}
					</pre>
				</div>
			) : null}
		</>
	);
}
