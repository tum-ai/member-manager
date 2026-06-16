import { useMutation } from "@tanstack/react-query";
import type {
	AssistantEvent,
	ComposerMention,
	PersonSuggestion,
	SearchResponse,
} from "../features/expertise/types";
import { apiClient, apiStream } from "../lib/apiClient";

export function useExpertiseSearch() {
	return useMutation({
		mutationFn: async (args: { text: string; mentions: ComposerMention[] }) =>
			(await apiClient("/api/expertise/search", {
				method: "POST",
				body: JSON.stringify(args),
			})) as SearchResponse,
	});
}

export interface AssistantRequest {
	messages: { role: "user" | "assistant"; content: string }[];
	text: string;
	mentions: ComposerMention[];
	loadedPillars: string[];
	chatId: string;
	turnId: string;
}

// Run the conversational assistant, streaming tool steps + the answer via SSE.
// Resolves when the stream ends.
export async function runAssistant(
	req: AssistantRequest,
	onEvent: (event: AssistantEvent) => void,
): Promise<void> {
	await apiStream(
		"/api/expertise/assistant",
		{
			messages: req.messages,
			text: req.text,
			mentions: req.mentions,
			loaded_pillars: req.loadedPillars,
			chat_id: req.chatId,
			turn_id: req.turnId,
		},
		(event) => onEvent(event as AssistantEvent),
	);
}

// Typeahead for the @-mention composer. Plain async (debounced by the caller).
export async function searchPeople(q: string): Promise<PersonSuggestion[]> {
	if (q.trim().length < 2) return [];
	const res = (await apiClient(
		`/api/expertise/people?q=${encodeURIComponent(q)}`,
		{ method: "GET" },
	)) as { people: PersonSuggestion[] };
	return res.people;
}
