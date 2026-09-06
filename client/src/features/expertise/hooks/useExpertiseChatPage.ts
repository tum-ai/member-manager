import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { useToast } from "@/contexts/ToastContext";
import { toPlainText } from "@/features/expertise/MentionText";
import type {
	AgentStep,
	ChatMessage,
	ComposerMention,
	SearchPerson,
} from "@/features/expertise/types";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { runAssistant } from "./useExpertiseSearch";

const MENTION_PATTERN = /@\[([^\]]+)\]\(beacon:([0-9a-f-]{36})\)/g;

const TOOL_LABELS: Record<string, string> = {
	load_pillar: "Opening the directory",
	read_knowledge_file: "Reading reference docs",
	search_members: "Searching the directory",
	find_people_by: "Looking people up",
	get_member_profile: "Reading a profile",
	resolve_person: "Finding the right person",
};

function labelForTool(name: string, args: unknown): string {
	const values =
		args && typeof args === "object" ? (args as Record<string, unknown>) : {};
	if (name === "find_people_by") {
		const key =
			values.project ?? values.organization ?? values.skill ?? values.tag;
		if (typeof key === "string" && key) return `Looking up “${key}”`;
	}
	if (
		name === "search_members" &&
		typeof values.query === "string" &&
		values.query
	) {
		return `Searching for “${values.query}”`;
	}
	return TOOL_LABELS[name] ?? "Working on it";
}

function mergePeople(previous: SearchPerson[], incoming: SearchPerson[]) {
	const byId = new Map(previous.map((person) => [person.user_id, person]));
	for (const person of incoming) {
		const existing = byId.get(person.user_id);
		if (!existing || person.score > existing.score)
			byId.set(person.user_id, person);
	}
	return [...byId.values()];
}

function upsertStep(steps: AgentStep[], next: AgentStep): AgentStep[] {
	return steps.some((step) => step.id === next.id)
		? steps.map((step) => (step.id === next.id ? next : step))
		: [...steps, next];
}

/** Owns Beacon conversation state, streamed events, panels, and user actions. */
export function useExpertiseChatPage(user: User) {
	useSetPageHeader("Agent");
	const { showToast } = useToast();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [profileTarget, setProfileTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [peopleOpen, setPeopleOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [logOpen, setLogOpen] = useState(false);
	const [chatId, setChatId] = useState(() => crypto.randomUUID());
	const [loadedPillars, setLoadedPillars] = useState<string[]>([]);
	const { isAdmin } = useIsAdmin(user.id);
	const scrollRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);

	const firstName = useMemo(() => {
		const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
		const stringValue = (key: string) =>
			typeof metadata[key] === "string" ? String(metadata[key]) : "";
		let name = stringValue("given_name") || stringValue("first_name");
		if (!name)
			name =
				(stringValue("name") || stringValue("full_name")).split(/\s+/)[0] ?? "";
		if (!name && user.email) name = user.email.split("@")[0] ?? "";
		return name ? name.charAt(0).toUpperCase() + name.slice(1) : "there";
	}, [user.email, user.user_metadata]);

	const mentionedPeople = useMemo(() => {
		const harvested = new Map<string, SearchPerson>();
		for (const message of messages) {
			for (const person of message.people ?? []) {
				const previous = harvested.get(person.user_id);
				if (!previous || person.score > previous.score)
					harvested.set(person.user_id, person);
			}
		}
		const cited = new Map<string, SearchPerson>();
		for (const message of messages) {
			if (message.role !== "assistant") continue;
			for (const match of message.text.matchAll(MENTION_PATTERN)) {
				const name = match[1];
				const userId = match[2];
				if (!name || !userId || cited.has(userId)) continue;
				cited.set(
					userId,
					harvested.get(userId) ?? {
						user_id: userId,
						name,
						avatar_url: null,
						best_chunk: null,
						score: 0,
					},
				);
			}
		}
		return [...cited.values()].sort((left, right) => right.score - left.score);
	}, [messages]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: new transcript content should auto-scroll when already near the end
	useEffect(() => {
		const container = scrollRef.current;
		if (
			!container ||
			container.scrollHeight - container.scrollTop - container.clientHeight >=
				140
		)
			return;
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	const clearChat = () => {
		setMessages([]);
		setProfileTarget(null);
		setPeopleOpen(false);
		setLogOpen(false);
		setLoadedPillars([]);
		setChatId(crypto.randomUUID());
	};

	const runConversation = async (text: string, mentions: ComposerMention[]) => {
		if (busy) return;
		const history = messages
			.filter((message) => !message.pending && message.text)
			.slice(-8)
			.map((message) => ({ role: message.role, content: message.text }));
		const pendingId = crypto.randomUUID();
		setMessages((current) => [
			...current,
			{ id: crypto.randomUUID(), role: "user", text },
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
		const patch = (update: (message: ChatMessage) => ChatMessage) =>
			setMessages((current) =>
				current.map((message) =>
					message.id === pendingId ? update(message) : message,
				),
			);

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
				(event) => {
					switch (event.type) {
						case "pillar_loaded":
							setLoadedPillars((current) => [
								...new Set([...current, event.pillar_id]),
							]);
							break;
						case "tool_call":
							patch((message) => ({
								...message,
								steps: upsertStep(message.steps ?? [], {
									id: event.id,
									label: labelForTool(event.name, event.args),
									status: "running",
								}),
							}));
							break;
						case "tool_result":
							patch((message) => ({
								...message,
								steps: (message.steps ?? []).map((step) =>
									step.id === event.id ? { ...step, status: "done" } : step,
								),
							}));
							break;
						case "people":
							patch((message) => ({
								...message,
								people: mergePeople(message.people ?? [], event.people),
							}));
							break;
						case "answer":
							patch((message) => ({ ...message, text: event.text }));
							break;
						case "error":
							patch((message) => ({
								...message,
								text: message.text || event.message,
								pending: false,
							}));
							showToast(event.message, "error");
							break;
						case "done":
							patch((message) => ({ ...message, pending: false }));
							break;
					}
				},
			);
			patch((message) => ({
				...message,
				text:
					message.text || "Beacon did not return an answer. Please try again.",
				pending: false,
			}));
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			patch((current) => ({
				...current,
				text: current.text || `Sorry, that didn't work: ${message}`,
				pending: false,
			}));
			showToast(`Beacon could not complete the request: ${message}`, "error");
		} finally {
			setBusy(false);
		}
	};

	const copyMessage = async (text: string) => {
		try {
			if (!navigator.clipboard)
				throw new Error("Clipboard access is unavailable");
			await navigator.clipboard.writeText(toPlainText(text));
			showToast("Answer copied.", "success");
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Could not copy the answer",
				"error",
			);
		}
	};

	return {
		user,
		firstName,
		messages,
		empty: messages.length === 0,
		busy,
		chatId,
		isAdmin,
		mentionedPeople,
		peopleOpen,
		setPeopleOpen,
		logOpen,
		setLogOpen,
		profileTarget,
		setProfileTarget,
		scrollRef,
		endRef,
		clearChat,
		runConversation,
		copyMessage,
	};
}

export type ExpertiseChatPageViewModel = ReturnType<
	typeof useExpertiseChatPage
>;
