import type {
	ExpertiseMatch,
	ExpertiseQueryResponse,
} from "@member-manager/shared";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { apiClient } from "@/lib/apiClient";

const MIN_QUESTION_LENGTH = 3;

export interface UseExpertiseQueryResult {
	question: string;
	setQuestion: (value: string) => void;
	submit: () => void;
	clear: () => void;
	isPending: boolean;
	answer: string | null;
	source: ExpertiseQueryResponse["source"] | null;
	rankedMatches: ExpertiseMatch[];
	highlightIds: Set<string>;
	scoreByUserId: Map<string, number>;
	hasResult: boolean;
}

// Drives the "ask the graph" panel: posts a natural-language question to the
// server and exposes the ranked matches so the canvas can highlight them.
export function useExpertiseQuery(): UseExpertiseQueryResult {
	const { showToast } = useToast();
	const [question, setQuestion] = useState("");
	const [result, setResult] = useState<ExpertiseQueryResponse | null>(null);

	const mutation = useMutation({
		mutationFn: async (trimmed: string) =>
			await apiClient<ExpertiseQueryResponse>("/api/members/expertise-query", {
				method: "POST",
				body: JSON.stringify({ question: trimmed }),
			}),
		onSuccess: (response) => {
			setResult(response);
		},
		onError: (error) => {
			showToast(`Could not answer that question: ${error.message}`, "error");
		},
	});

	function submit(): void {
		const trimmed = question.trim();
		if (trimmed.length < MIN_QUESTION_LENGTH) {
			showToast("Ask a slightly longer question.", "warning");
			return;
		}
		mutation.mutate(trimmed);
	}

	function clear(): void {
		setResult(null);
		mutation.reset();
	}

	const rankedMatches = result?.matches ?? [];

	const highlightIds = useMemo(
		() => new Set(rankedMatches.map((match) => match.userId)),
		[rankedMatches],
	);

	const scoreByUserId = useMemo(
		() => new Map(rankedMatches.map((match) => [match.userId, match.score])),
		[rankedMatches],
	);

	return {
		question,
		setQuestion,
		submit,
		clear,
		isPending: mutation.isPending,
		answer: result?.answer ?? null,
		source: result?.source ?? null,
		rankedMatches,
		highlightIds,
		scoreByUserId,
		hasResult: result !== null,
	};
}
