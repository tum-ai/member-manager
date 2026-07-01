import type {
	ExpertiseMatch,
	ExpertiseQueryResponse,
} from "@member-manager/shared";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const OPENAI_CHAT_COMPLETIONS_URL =
	"https://api.openai.com/v1/chat/completions";

const MAX_MATCHES = 10;
const MIN_TOKEN_LENGTH = 3;

// Common English words that add no signal when matching expertise.
const STOPWORDS = new Set([
	"the",
	"and",
	"for",
	"who",
	"can",
	"has",
	"have",
	"with",
	"about",
	"that",
	"this",
	"our",
	"any",
	"you",
	"your",
	"are",
	"was",
	"were",
	"how",
	"what",
	"which",
	"where",
	"when",
	"know",
	"knows",
	"help",
	"looking",
	"someone",
	"member",
	"members",
	"expert",
	"experts",
	"experience",
	"experienced",
]);

export interface ExpertiseCandidate {
	userId: string;
	name: string;
	department: string | null;
	batch: string | null;
	degree: string | null;
	school: string | null;
	expertiseSummary: string | null;
	expertiseTags: string[];
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(
			(token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token),
		);
}

function buildHaystack(candidate: ExpertiseCandidate): string {
	return [
		...candidate.expertiseTags,
		candidate.expertiseSummary ?? "",
		candidate.department ?? "",
		candidate.degree ?? "",
		candidate.school ?? "",
	]
		.join(" ")
		.toLowerCase();
}

function clampScore(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}
	return Math.min(1, Math.max(0, value));
}

export function rankByKeyword(
	question: string,
	candidates: ExpertiseCandidate[],
): ExpertiseMatch[] {
	const questionTokens = tokenize(question);
	const uniqueQuestionTokens = [...new Set(questionTokens)];

	const matches: Array<ExpertiseMatch & { name: string }> = [];

	for (const candidate of candidates) {
		const haystack = buildHaystack(candidate);
		const matchedTokens = uniqueQuestionTokens.filter((token) =>
			haystack.includes(token),
		);

		if (matchedTokens.length === 0) {
			continue;
		}

		// Normalize to [0,1]: fraction of distinct question tokens that hit the
		// candidate's expertise haystack, capped at 1.
		const score = clampScore(
			matchedTokens.length / Math.max(1, uniqueQuestionTokens.length),
		);
		matches.push({
			userId: candidate.userId,
			score,
			reason: `Matched: ${matchedTokens.join(", ")}`,
			name: candidate.name,
		});
	}

	return matches
		.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
		.slice(0, MAX_MATCHES)
		.map(({ userId, score, reason }) => ({ userId, score, reason }));
}

export function answerFromMatches(
	question: string,
	candidates: ExpertiseCandidate[],
	matches: ExpertiseMatch[],
): string {
	if (matches.length === 0) {
		return `No members matched "${question}".`;
	}

	const nameByUserId = new Map(candidates.map((c) => [c.userId, c.name]));
	const summary = matches
		.map((match) => {
			const name = nameByUserId.get(match.userId) ?? match.userId;
			return `${name} (${match.reason})`;
		})
		.join("; ");

	return `Found ${matches.length} member${
		matches.length === 1 ? "" : "s"
	} related to "${question}": ${summary}`;
}

function buildFallbackResponse(
	question: string,
	candidates: ExpertiseCandidate[],
): ExpertiseQueryResponse {
	const matches = rankByKeyword(question, candidates);
	return {
		answer: answerFromMatches(question, candidates, matches),
		matches,
		source: "fallback",
	};
}

function formatCandidateForPrompt(candidate: ExpertiseCandidate): string {
	// Only non-sensitive expertise-relevant fields are ever exposed to the model.
	return [
		`userId: ${candidate.userId}`,
		`name: ${candidate.name}`,
		`department: ${candidate.department ?? "unknown"}`,
		`batch: ${candidate.batch ?? "unknown"}`,
		`degree: ${candidate.degree ?? "unknown"}`,
		`school: ${candidate.school ?? "unknown"}`,
		`expertiseSummary: ${candidate.expertiseSummary ?? "unknown"}`,
		`expertiseTags: ${candidate.expertiseTags.join(", ") || "none"}`,
	].join(" | ");
}

export async function answerExpertiseQuery(
	question: string,
	candidates: ExpertiseCandidate[],
): Promise<ExpertiseQueryResponse> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey || candidates.length === 0) {
		return buildFallbackResponse(question, candidates);
	}

	const candidateIds = new Set(candidates.map((c) => c.userId));

	try {
		const response = await fetchWithTimeout(OPENAI_CHAT_COMPLETIONS_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content:
							'You match TUM.ai members to an expertise question. Only use the provided candidates. Respond with STRICT JSON of the shape {"answer": string, "matches": [{"userId": string, "score": number, "reason": string}]}. score is a relevance value between 0 and 1. Only include userIds present in the candidate list. reason briefly explains the match.',
					},
					{
						role: "user",
						content: `Question: ${question}\n\nCandidates:\n${candidates
							.map(formatCandidateForPrompt)
							.join("\n")}`,
					},
				],
				temperature: 0.2,
			}),
		});

		if (!response.ok) {
			return buildFallbackResponse(question, candidates);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const content = data.choices?.[0]?.message?.content?.trim();
		if (!content) {
			return buildFallbackResponse(question, candidates);
		}

		// The model returns JSON as a string; parse it defensively and validate the
		// shape before trusting any field.
		const parsed = JSON.parse(content) as {
			answer?: unknown;
			matches?: unknown;
		};
		const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : [];

		const matches: ExpertiseMatch[] = rawMatches
			.map((entry): ExpertiseMatch | null => {
				if (typeof entry !== "object" || entry === null) {
					return null;
				}
				const record = entry as {
					userId?: unknown;
					score?: unknown;
					reason?: unknown;
				};
				if (typeof record.userId !== "string") {
					return null;
				}
				return {
					userId: record.userId,
					score: clampScore(Number(record.score)),
					reason: typeof record.reason === "string" ? record.reason : "",
				};
			})
			.filter(
				(match): match is ExpertiseMatch =>
					match !== null && candidateIds.has(match.userId),
			)
			.sort((a, b) => b.score - a.score)
			.slice(0, MAX_MATCHES);

		const answer =
			typeof parsed.answer === "string" && parsed.answer.trim()
				? parsed.answer.trim()
				: answerFromMatches(question, candidates, matches);

		return { answer, matches, source: "llm" };
	} catch {
		return buildFallbackResponse(question, candidates);
	}
}
