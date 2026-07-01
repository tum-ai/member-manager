// Contract for the "ask the graph" expertise Q&A endpoint
// (POST /api/members/expertise-query). Framework-free types only; the Zod
// request schema lives with the server route (shared/ carries no Zod dependency).

export interface ExpertiseQueryRequest {
	question: string;
}

export interface ExpertiseMatch {
	// Member user_id. Always one of the candidate members the server considered.
	userId: string;
	// Relevance in [0, 1]; higher is a stronger match.
	score: number;
	// Short human-readable justification (e.g. "Matched: machine-learning, nlp").
	reason: string;
}

export interface ExpertiseQueryResponse {
	answer: string;
	matches: ExpertiseMatch[];
	// Whether the answer came from the LLM or the deterministic keyword fallback.
	source: "llm" | "fallback";
}
