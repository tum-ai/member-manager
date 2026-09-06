import {
	type AssistantEvent,
	type AssistantMessage,
	assistantEventSchema,
	assistantRequestSchema,
	type ComposerMention,
	type PersonSuggestion,
	personSuggestionSchema,
	type SearchResponse,
	searchRequestSchema,
	searchResponseSchema,
} from "@member-manager/shared";
import { useMutation } from "@tanstack/react-query";
import { apiClient, apiStream } from "@/lib/apiClient";

export interface AssistantConversationRequest {
	messages: AssistantMessage[];
	text: string;
	mentions: ComposerMention[];
	loadedPillars: string[];
	chatId: string;
	turnId: string;
}

/** Legacy single-shot search retained for callers that cannot consume SSE. */
export async function searchExpertise(
	text: string,
	mentions: ComposerMention[],
): Promise<SearchResponse> {
	const body = searchRequestSchema.parse({ text, mentions });
	return searchResponseSchema.parse(
		await apiClient<unknown>("/api/expertise/search", {
			method: "POST",
			body: JSON.stringify(body),
		}),
	);
}

/** Mutation wrapper for the backwards-compatible JSON search endpoint. */
export function useExpertiseSearch() {
	return useMutation({
		mutationFn: (args: { text: string; mentions: ComposerMention[] }) =>
			searchExpertise(args.text, args.mentions),
	});
}

/** Streams one assistant turn and validates every event before exposing it. */
export async function runAssistant(
	request: AssistantConversationRequest,
	onEvent: (event: AssistantEvent) => void,
): Promise<void> {
	const body = assistantRequestSchema.parse({
		messages: request.messages,
		text: request.text,
		mentions: request.mentions,
		loaded_pillars: request.loadedPillars,
		chat_id: request.chatId,
		turn_id: request.turnId,
	});
	await apiStream("/api/expertise/assistant", body, (event) => {
		onEvent(assistantEventSchema.parse(event));
	});
}

/** Fetches validated member suggestions for the composer combobox. */
export async function searchPeople(q: string): Promise<PersonSuggestion[]> {
	const query = q.trim();
	if (query.length < 2) return [];
	const response = await apiClient<unknown>(
		`/api/expertise/people?q=${encodeURIComponent(query)}`,
		{ method: "GET" },
	);
	if (!response || typeof response !== "object" || !("people" in response)) {
		throw new Error("The member search returned an invalid response");
	}
	return personSuggestionSchema.array().parse(response.people);
}
