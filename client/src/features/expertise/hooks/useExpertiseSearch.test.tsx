import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import {
	runAssistant,
	searchPeople,
	useExpertiseSearch,
} from "./useExpertiseSearch";

const PERSON_ID = "11111111-1111-4111-8111-111111111111";

describe("Beacon search data", () => {
	it("uses the backwards-compatible JSON search endpoint", async () => {
		server.use(
			http.post("/api/expertise/search", () =>
				HttpResponse.json({
					answer: "Ask Ada",
					people: [
						{
							user_id: PERSON_ID,
							name: "Ada",
							avatar_url: null,
							best_chunk: null,
							score: 0.9,
						},
					],
					dsl: {},
				}),
			),
		);
		const { result } = renderHookWithClient(() => useExpertiseSearch());
		await act(async () => {
			await result.current.mutateAsync({
				text: "Who knows Swift?",
				mentions: [],
			});
		});
		await waitFor(() => expect(result.current.data?.answer).toBe("Ask Ada"));
	});

	it("validates mention search responses", async () => {
		server.use(
			http.get("/api/expertise/people", () =>
				HttpResponse.json({
					people: [{ user_id: PERSON_ID, name: "Ada", avatar_url: null }],
				}),
			),
		);
		await expect(searchPeople("ad")).resolves.toEqual([
			{ user_id: PERSON_ID, name: "Ada", avatar_url: null },
		]);
	});

	it("rejects an invalid mention response", async () => {
		server.use(
			http.get("/api/expertise/people", () =>
				HttpResponse.json({ people: [{ name: "Missing id" }] }),
			),
		);
		await expect(searchPeople("mi")).rejects.toThrow();
	});

	it("validates streamed assistant events", async () => {
		server.use(
			http.post(
				"/api/expertise/assistant",
				() =>
					new HttpResponse(
						'data: {"type":"answer","text":"Hello"}\n\ndata: {"type":"done"}\n\n',
						{ headers: { "content-type": "text/event-stream" } },
					),
			),
		);
		const events: string[] = [];
		await runAssistant(
			{
				messages: [],
				text: "Hello",
				mentions: [],
				loadedPillars: [],
				chatId: PERSON_ID,
				turnId: "22222222-2222-4222-8222-222222222222",
			},
			(event) => events.push(event.type),
		);
		await waitFor(() => expect(events).toEqual(["answer", "done"]));
	});
});
