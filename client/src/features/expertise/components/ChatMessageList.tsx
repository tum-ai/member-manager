import { Check, ChevronRight, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownMessage } from "@/features/expertise/MentionText";
import { ThinkingShimmer } from "@/features/expertise/ThinkingShimmer";
import { ThinkingTrace } from "@/features/expertise/ThinkingTrace";
import type { AgentStep, ChatMessage } from "@/features/expertise/types";
import { cn } from "@/lib/utils";

interface ChatMessageListProps {
	messages: ChatMessage[];
	onOpenProfile: (id: string, name: string) => void;
	onRegenerate: (query: string) => void;
	onCopy: (text: string) => void;
}

/** Presentational transcript for a Beacon conversation. */
export function ChatMessageList({
	messages,
	onOpenProfile,
	onRegenerate,
	onCopy,
}: ChatMessageListProps): JSX.Element {
	return (
		<div
			className="space-y-8"
			aria-live="polite"
			aria-busy={messages.some((message) => message.pending)}
		>
			{messages.map((message) => (
				<MessageView
					key={message.id}
					message={message}
					onOpenProfile={onOpenProfile}
					onRegenerate={onRegenerate}
					onCopy={onCopy}
				/>
			))}
		</div>
	);
}

function MessageView({
	message,
	onOpenProfile,
	onRegenerate,
	onCopy,
}: {
	message: ChatMessage;
	onOpenProfile: (id: string, name: string) => void;
	onRegenerate: (query: string) => void;
	onCopy: (text: string) => void;
}): JSX.Element {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div className="max-w-[90%] rounded-3xl bg-brand px-4 py-2 text-sm text-brand-foreground sm:max-w-[80%]">
					{message.text}
				</div>
			</div>
		);
	}

	if (message.pending) {
		return message.steps?.length ? (
			<ThinkingTrace steps={message.steps} />
		) : (
			<ThinkingShimmer />
		);
	}

	return (
		<div className="space-y-2">
			<ThoughtDisclosure
				steps={message.steps}
				count={message.people?.length ?? 0}
			/>
			<div className="beacon-fade-up text-[15px] leading-relaxed">
				<MarkdownMessage text={message.text} onOpenProfile={onOpenProfile} />
			</div>
			<div className="flex items-center gap-0.5 pt-0.5 text-muted-foreground">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={() => onCopy(message.text)}
					aria-label="Copy answer"
				>
					<Copy className="size-4" />
				</Button>
				{message.query ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={() => onRegenerate(message.query ?? "")}
						aria-label="Regenerate answer"
					>
						<RefreshCw className="size-4" />
					</Button>
				) : null}
			</div>
		</div>
	);
}

function ThoughtDisclosure({
	steps,
	count,
}: {
	steps?: AgentStep[];
	count: number;
}): JSX.Element | null {
	const counts = new Map<string, number>();
	for (const step of steps ?? [])
		counts.set(step.label, (counts.get(step.label) ?? 0) + 1);
	const items = [...counts.entries()];
	if (!items.length) return null;
	const total = steps?.length ?? 0;
	return (
		<details className="group">
			<summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
				<ChevronRight className="size-4 transition-transform group-open:rotate-90" />
				{total} {total === 1 ? "step" : "steps"}
				{count > 0 ? ` · ${count} ${count === 1 ? "person" : "people"}` : ""}
			</summary>
			<div className="beacon-fade-up mt-2 ml-[7px] space-y-2 border-l border-border/60 pl-4 text-sm text-muted-foreground">
				{items.map(([label, number]) => (
					<div key={label} className="relative flex items-center gap-2">
						<Check
							className={cn(
								"absolute -left-[22px] size-3 rounded-full bg-background",
								"text-muted-foreground",
							)}
						/>
						<span>{label}</span>
						{number > 1 ? (
							<span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
								×{number}
							</span>
						) : null}
					</div>
				))}
			</div>
		</details>
	);
}
