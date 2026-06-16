import type { User } from "@supabase/supabase-js";
import {
	Building2,
	Check,
	ChevronRight,
	Copy,
	GraduationCap,
	RefreshCw,
	ScrollText,
	SquarePen,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { runAssistant } from "../../hooks/useExpertiseSearch";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { AgentLogSheet } from "./AgentLogSheet";
import "./beacon.css";
import { Composer } from "./Composer";
import ExpertiseProfilePage from "./ExpertiseProfilePage";
import { MarkdownMessage, toPlainText } from "./MentionText";
import { PeoplePanel } from "./PeoplePanel";
import { ThinkingShimmer } from "./ThinkingShimmer";
import { ThinkingTrace } from "./ThinkingTrace";
import type {
	AgentStep,
	AssistantEvent,
	ChatMessage,
	ComposerMention,
	SearchPerson,
} from "./types";

const SUGGESTIONS = [
	{ icon: Building2, text: "Who has worked at a big tech company?" },
	{ icon: GraduationCap, text: "Find someone with a US Ivy League degree" },
	{ icon: Users, text: "A senior iOS dev who shipped an App Store app" },
];

function firstNameOf(user: User): string {
	const md = (user.user_metadata ?? {}) as Record<string, unknown>;
	const get = (k: string) =>
		typeof md[k] === "string" ? (md[k] as string) : "";
	let n = get("given_name") || get("first_name");
	if (!n) {
		const full = get("name") || get("full_name");
		if (full) n = full.split(/\s+/)[0];
	}
	if (!n && user.email) n = user.email.split("@")[0];
	return n ? n.charAt(0).toUpperCase() + n.slice(1) : "there";
}

const TOOL_LABELS: Record<string, string> = {
	load_pillar: "Opening the directory",
	read_knowledge_file: "Reading reference docs",
	search_members: "Searching the directory",
	find_people_by: "Looking people up",
	get_member_profile: "Reading a profile",
	resolve_person: "Finding the right person",
};

function labelForTool(name: string, args: unknown): string {
	const a = (args ?? {}) as Record<string, unknown>;
	if (name === "find_people_by") {
		const key = a.project ?? a.organization ?? a.skill ?? a.tag;
		if (typeof key === "string" && key) return `Looking up “${key}”`;
	}
	if (name === "search_members" && typeof a.query === "string" && a.query) {
		return `Searching for “${a.query}”`;
	}
	return TOOL_LABELS[name] ?? "Working on it";
}

function mergePeople(
	prev: SearchPerson[],
	incoming: SearchPerson[],
): SearchPerson[] {
	const byId = new Map(prev.map((p) => [p.user_id, p]));
	for (const p of incoming) {
		const existing = byId.get(p.user_id);
		if (!existing || p.score > existing.score) byId.set(p.user_id, p);
	}
	return [...byId.values()];
}

function upsertStep(steps: AgentStep[], step: AgentStep): AgentStep[] {
	if (steps.some((s) => s.id === step.id))
		return steps.map((s) => (s.id === step.id ? step : s));
	return [...steps, step];
}

export default function ExpertiseChatPage({
	user,
}: {
	user: User;
}): JSX.Element {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [profileTarget, setProfileTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [peopleOpen, setPeopleOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [logOpen, setLogOpen] = useState(false);
	// Stable id correlating every turn of this chat in the admin activity log.
	const [chatId, setChatId] = useState(() => crypto.randomUUID());
	// Pillars the agent has loaded this conversation; resent so they stay loaded.
	const [loadedPillars, setLoadedPillars] = useState<string[]>([]);
	const { isAdmin } = useIsAdmin(user.id);
	const scrollRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);

	// Show ONLY people actually cited (@[name](beacon:uid)) in the assistant's
	// answers — not everyone a tool searched. Enrich each with harvested data
	// (avatar/score/reason) when we have it.
	const mentionedPeople = useMemo(() => {
		const harvested = new Map<string, SearchPerson>();
		for (const m of messages) {
			for (const p of m.people ?? []) {
				const prev = harvested.get(p.user_id);
				if (!prev || p.score > prev.score) harvested.set(p.user_id, p);
			}
		}
		const re = /@\[([^\]]+)\]\(beacon:([0-9a-f-]{36})\)/g;
		const cited = new Map<string, SearchPerson>();
		for (const m of messages) {
			if (m.role !== "assistant" || !m.text) continue;
			for (const [, name, uid] of m.text.matchAll(re)) {
				if (cited.has(uid)) continue;
				cited.set(
					uid,
					harvested.get(uid) ?? {
						user_id: uid,
						name,
						avatar_url: null,
						best_chunk: null,
						score: 0,
					},
				);
			}
		}
		return [...cited.values()].sort((a, b) => b.score - a.score);
	}, [messages]);
	const hasPeople = mentionedPeople.length > 0;

	const nearBottom = () => {
		const el = scrollRef.current;
		if (!el) return true;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
	};
	const scrollEnd = (smooth: boolean) => {
		if (nearBottom())
			endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when count changes
	useEffect(() => {
		scrollEnd(true);
	}, [messages.length]);

	const clearChat = () => {
		setMessages([]);
		setProfileTarget(null);
		setPeopleOpen(false);
		setLogOpen(false);
		setLoadedPillars([]);
		setChatId(crypto.randomUUID());
	};
	const openProfile = (id: string, name: string) =>
		setProfileTarget({ id, name });

	const runConversation = async (text: string, mentions: ComposerMention[]) => {
		// Prior turns (raw text keeps @[name](beacon:id) so follow-ups resolve).
		const history = messages
			.filter((m) => !m.pending && m.text)
			.slice(-8)
			.map((m) => ({ role: m.role, content: m.text }));

		const userMsgId = crypto.randomUUID();
		const pendingId = crypto.randomUUID();
		setMessages((m) => [
			...m,
			{ id: userMsgId, role: "user", text },
			{
				id: pendingId,
				role: "assistant",
				text: "",
				pending: true,
				query: text,
				steps: [],
			},
		]);
		setBusy(true);

		const patch = (fn: (msg: ChatMessage) => ChatMessage) =>
			setMessages((m) => m.map((x) => (x.id === pendingId ? fn(x) : x)));

		const handle = (e: AssistantEvent) => {
			switch (e.type) {
				case "pillar_loaded":
					// Just track state; the load_pillar tool_call already shows a step.
					setLoadedPillars((p) => [...new Set([...p, e.pillar_id])]);
					break;
				case "tool_call":
					patch((x) => ({
						...x,
						steps: upsertStep(x.steps ?? [], {
							id: e.id,
							label: labelForTool(e.name, e.args),
							status: "running",
						}),
					}));
					break;
				case "tool_result":
					patch((x) => ({
						...x,
						steps: (x.steps ?? []).map((s) =>
							s.id === e.id ? { ...s, status: "done" } : s,
						),
					}));
					break;
				case "people":
					patch((x) => ({
						...x,
						people: mergePeople(x.people ?? [], e.people),
					}));
					break;
				case "answer":
					patch((x) => ({ ...x, text: e.text }));
					break;
				case "error":
					patch((x) => ({ ...x, text: x.text || e.message }));
					break;
				case "done":
					patch((x) => ({ ...x, pending: false }));
					break;
			}
		};

		try {
			await runAssistant(
				{
					messages: history,
					text,
					mentions,
					loadedPillars,
					chatId,
					turnId: pendingId,
				},
				handle,
			);
			patch((x) => (x.pending ? { ...x, pending: false } : x));
		} catch (e) {
			patch((x) => ({
				...x,
				text:
					x.text ||
					`Sorry, that didn't work: ${e instanceof Error ? e.message : "unknown error"}`,
				pending: false,
				streamed: true,
			}));
		} finally {
			setBusy(false);
		}
	};
	// Panel stays closed until the user opens it via the top-right control.

	const empty = messages.length === 0;

	return (
		<div className="flex min-h-0 flex-1">
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				{empty ? (
					<div className="flex flex-1 flex-col items-center justify-center px-4">
						<h1 className="mb-8 text-center text-3xl font-semibold tracking-tight">
							Good to see you, {firstNameOf(user)}.
						</h1>
						<div className="w-full max-w-2xl">
							<Composer onSubmit={runConversation} disabled={busy} autoFocus />
						</div>
						<div className="mt-4 flex flex-wrap justify-center gap-2">
							{SUGGESTIONS.map(({ icon: Icon, text }) => (
								<button
									key={text}
									type="button"
									onClick={() => runConversation(text, [])}
									className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
								>
									<Icon className="size-4" />
									{text}
								</button>
							))}
						</div>
					</div>
				) : (
					<>
						<div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
							<button
								type="button"
								onClick={clearChat}
								className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
							>
								<SquarePen className="size-3.5" />
								New chat
							</button>
							<div className="flex items-center gap-1.5">
								{isAdmin && (
									<button
										type="button"
										onClick={() => setLogOpen(true)}
										aria-label="Open model activity log"
										className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
									>
										<ScrollText className="size-3.5" />
										Log
									</button>
								)}
								{hasPeople && !peopleOpen && (
									<button
										type="button"
										onClick={() => setPeopleOpen(true)}
										aria-label={`Show ${mentionedPeople.length} referenced people`}
										className="relative hidden size-9 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground lg:inline-flex"
									>
										<Users className="size-[18px]" />
										<span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
											{mentionedPeople.length}
										</span>
									</button>
								)}
							</div>
						</div>
						<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
							<div className="mx-auto max-w-3xl space-y-8 px-4 pb-6 pt-6">
								{messages.map((msg) => (
									<MessageView
										key={msg.id}
										msg={msg}
										onOpenProfile={openProfile}
										onRegenerate={() =>
											msg.query && runConversation(msg.query, [])
										}
									/>
								))}
								<div ref={endRef} />
							</div>
						</div>
						<div className="mx-auto w-full max-w-3xl px-4 pb-4">
							<Composer onSubmit={runConversation} disabled={busy} />
							<p className="mt-2 text-center text-[11px] text-muted-foreground">
								Beacon can make mistakes. Verify important details.
							</p>
						</div>
					</>
				)}
			</div>

			{hasPeople && peopleOpen && (
				<PeoplePanel
					people={mentionedPeople}
					onOpen={openProfile}
					onClose={() => setPeopleOpen(false)}
				/>
			)}

			{isAdmin && (
				<AgentLogSheet
					chatId={chatId}
					open={logOpen}
					onOpenChange={setLogOpen}
				/>
			)}

			<Sheet
				open={!!profileTarget}
				onOpenChange={(o) => !o && setProfileTarget(null)}
			>
				<SheetContent
					side="right"
					className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>{profileTarget?.name ?? "Profile"}</SheetTitle>
					</SheetHeader>
					{profileTarget && (
						<div className="p-4 sm:p-6">
							<ExpertiseProfilePage user={user} userId={profileTarget.id} />
						</div>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function MessageView({
	msg,
	onOpenProfile,
	onRegenerate,
}: {
	msg: ChatMessage;
	onOpenProfile: (id: string, name: string) => void;
	onRegenerate: () => void;
}): JSX.Element {
	if (msg.role === "user") {
		return (
			<div className="flex justify-end">
				<div className="max-w-[80%] rounded-3xl bg-brand px-4 py-2 text-sm text-brand-foreground">
					{msg.text}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{msg.pending ? (
				msg.steps && msg.steps.length > 0 ? (
					<ThinkingTrace steps={msg.steps} />
				) : (
					<ThinkingShimmer />
				)
			) : (
				<>
					<ThoughtDisclosure
						steps={msg.steps}
						count={msg.people?.length ?? 0}
					/>
					<div className="beacon-fade-up text-[15px] leading-relaxed">
						<MarkdownMessage text={msg.text} onOpenProfile={onOpenProfile} />
					</div>
					<ActionRow text={msg.text} onRegenerate={onRegenerate} />
				</>
			)}
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
	const [open, setOpen] = useState(false);
	// Collapse repeated steps into "label ×N", preserving first-seen order.
	const counts = new Map<string, number>();
	for (const s of steps ?? [])
		counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
	const items = [...counts.entries()];
	const total = steps?.length ?? 0;
	if (!items.length) return null;
	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ChevronRight
					className={cn("size-4 transition-transform", open && "rotate-90")}
				/>
				{total} {total === 1 ? "step" : "steps"}
				{count > 0 && ` · ${count} ${count === 1 ? "person" : "people"}`}
			</button>
			{open && (
				<div className="beacon-fade-up mt-2 ml-[7px] space-y-2 border-l border-border/60 pl-4 text-sm text-muted-foreground">
					{items.map(([label, n]) => (
						<div key={label} className="relative flex items-center gap-2">
							<span className="absolute -left-[20px] size-1.5 rounded-full bg-muted-foreground/40" />
							<span>{label}</span>
							{n > 1 && (
								<span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground/60">
									×{n}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ActionRow({
	text,
	onRegenerate,
}: {
	text: string;
	onRegenerate: () => void;
}): JSX.Element {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		navigator.clipboard?.writeText(toPlainText(text));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	};
	return (
		<div className="flex items-center gap-0.5 pt-0.5 text-muted-foreground">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={copy}
				aria-label="Copy"
			>
				{copied ? <Check className="size-4" /> : <Copy className="size-4" />}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onRegenerate}
				aria-label="Regenerate"
			>
				<RefreshCw className="size-4" />
			</Button>
		</div>
	);
}
