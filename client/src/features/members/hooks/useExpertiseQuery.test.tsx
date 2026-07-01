import type { ExpertiseQueryResponse } from "@member-manager/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "@/contexts/ToastContext";
import { HttpResponse, http, server } from "@/test/mswServer";
import { createTestQueryClient } from "@/test/renderWithClient";
import { useExpertiseQuery } from "./useExpertiseQuery";

function createWrapper() {
	const queryClient = createTestQueryClient();
	return function Wrapper({ children }: PropsWithChildren): ReactElement {
		return (
			<QueryClientProvider client={queryClient}>
				<ToastProvider>{children}</ToastProvider>
			</QueryClientProvider>
		);
	};
}

const response: ExpertiseQueryResponse = {
	answer: "Ada and Ben work on machine learning.",
	source: "llm",
	matches: [
		{ userId: "a", score: 0.9, reason: "Matched: machine-learning" },
		{ userId: "b", score: 0.6, reason: "Matched: nlp" },
	],
};

describe("useExpertiseQuery", () => {
	it("derives highlight ids and scores from a successful answer", async () => {
		server.use(
			http.post("/api/members/expertise-query", () =>
				HttpResponse.json(response),
			),
		);
		const { result } = renderHook(() => useExpertiseQuery(), {
			wrapper: createWrapper(),
		});

		act(() => result.current.setQuestion("Who knows machine learning?"));
		act(() => result.current.submit());

		await waitFor(() => expect(result.current.hasResult).toBe(true));

		expect(result.current.answer).toContain("machine learning");
		expect(result.current.source).toBe("llm");
		expect(result.current.rankedMatches).toHaveLength(2);
		expect([...result.current.highlightIds]).toEqual(["a", "b"]);
		expect(result.current.scoreByUserId.get("a")).toBe(0.9);

		act(() => result.current.clear());
		expect(result.current.hasResult).toBe(false);
		expect(result.current.highlightIds.size).toBe(0);
	});

	it("does not fire a request for questions that are too short", async () => {
		let called = false;
		server.use(
			http.post("/api/members/expertise-query", () => {
				called = true;
				return HttpResponse.json(response);
			}),
		);
		const { result } = renderHook(() => useExpertiseQuery(), {
			wrapper: createWrapper(),
		});

		act(() => result.current.setQuestion("hi"));
		act(() => result.current.submit());

		expect(called).toBe(false);
		expect(result.current.hasResult).toBe(false);
	});
});
