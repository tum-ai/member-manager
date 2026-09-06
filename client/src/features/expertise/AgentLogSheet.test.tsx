import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import { AgentLogSheet } from "./AgentLogSheet";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";

function turn(trace: unknown) {
	return {
		id: "log-1",
		chat_id: CHAT_ID,
		turn_id: "22222222-2222-4222-8222-222222222222",
		user_id: "33333333-3333-4333-8333-333333333333",
		query: "Who knows Swift?",
		model: "gpt-test",
		trace,
		step_count: 1,
		people_count: 1,
		duration_ms: 125,
		created_at: "2026-08-26T10:00:00.000Z",
	};
}

describe("AgentLogSheet", () => {
	it("renders representative sanitized traces with omitted tool results", async () => {
		server.use(
			http.get("/api/admin/beacon/agent-log", () =>
				HttpResponse.json({
					turns: [
						turn({
							rounds: [
								{
									index: 0,
									response_id: "response-1",
									tool_calls: [
										{
											call_id: "call-1",
											name: "lookup_member",
											args: {
												profile: { public_location: "Munich" },
											},
											people: [
												{
													user_id: "33333333-3333-4333-8333-333333333333",
													name: "Ada Lovelace",
												},
											],
											ms: 18,
										},
									],
									text: "",
								},
							],
							loadedPillars: ["members"],
							rawAnswer: "Ask Ada",
							finalAnswer: "Ask Ada",
							degraded: false,
						}),
					],
				}),
			),
		);
		renderWithClient(
			<AgentLogSheet chatId={CHAT_ID} open onOpenChange={vi.fn()} />,
		);
		expect(await screen.findByText("Who knows Swift?")).toBeInTheDocument();
		await userEvent.click(screen.getByText("lookup_member"));
		expect(screen.getByText(/public_location/)).toBeInTheDocument();
		expect(
			screen.getByText("Tool result omitted from the stored trace."),
		).toBeInTheDocument();
		expect(screen.getByText("Ask Ada")).toBeInTheDocument();
	});

	it("explains the whole-trace truncation marker", async () => {
		server.use(
			http.get("/api/admin/beacon/agent-log", () =>
				HttpResponse.json({
					turns: [
						turn({
							truncated: true,
							reason: "agent trace exceeded persistence limit",
						}),
					],
				}),
			),
		);
		renderWithClient(
			<AgentLogSheet chatId={CHAT_ID} open onOpenChange={vi.fn()} />,
		);
		expect(
			await screen.findByText("Trace details were not stored"),
		).toBeInTheDocument();
		expect(
			screen.getByText("The sanitized trace exceeded the persistence limit."),
		).toBeInTheDocument();
	});
});
