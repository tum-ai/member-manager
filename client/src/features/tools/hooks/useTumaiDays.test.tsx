import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TumaiDayEvent } from "@/features/tools/tumaiDaysTypes";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useTumaiDays } from "./useTumaiDays";

const showToast = vi.fn();
vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

function makeEvent(overrides: Partial<TumaiDayEvent> = {}): TumaiDayEvent {
	return {
		id: "evt-1",
		agenda: "Quarterly gathering",
		scheduled_at: "2026-09-01T17:00:00.000Z",
		sent_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("useTumaiDays", () => {
	beforeEach(() => {
		showToast.mockClear();
	});

	it("fetches events from /api/tum-ai-days", async () => {
		server.use(
			http.get("/api/tum-ai-days", () =>
				HttpResponse.json({ events: [makeEvent()] }),
			),
		);

		const { result } = renderHookWithClient(() => useTumaiDays());

		await waitFor(() => expect(result.current.events).toHaveLength(1));
		expect(result.current.events[0].id).toBe("evt-1");
	});

	it("does not fetch responses until an event is selected", async () => {
		let responsesHit = 0;
		server.use(
			http.get("/api/tum-ai-days", () => HttpResponse.json({ events: [] })),
			http.get("/api/tum-ai-days/:id/responses", () => {
				responsesHit += 1;
				return HttpResponse.json({
					event: makeEvent(),
					stats: { yes: 1, no: 0, pending: 1, total: 2 },
					responses: [],
				});
			}),
		);

		const { result } = renderHookWithClient(() => useTumaiDays());
		await waitFor(() => expect(result.current.isLoadingEvents).toBe(false));
		expect(responsesHit).toBe(0);

		act(() => result.current.setSelectedEventId("evt-1"));

		await waitFor(() => expect(result.current.responsesData).toBeDefined());
		expect(responsesHit).toBe(1);
		expect(result.current.responseRate).toBe(50);
	});

	it("validates required fields on submit without firing a request", async () => {
		server.use(
			http.get("/api/tum-ai-days", () => HttpResponse.json({ events: [] })),
		);
		const { result } = renderHookWithClient(() => useTumaiDays());
		await waitFor(() => expect(result.current.isLoadingEvents).toBe(false));

		act(() => {
			result.current.handleSubmit({
				preventDefault: () => {},
			} as React.FormEvent);
		});

		expect(showToast).toHaveBeenCalledWith(
			"Please fill in both fields",
			"warning",
		);
	});

	it("POSTs a new event and selects it on success", async () => {
		let body: { agenda: string; scheduledAt: string } | null = null;
		server.use(
			http.get("/api/tum-ai-days", () => HttpResponse.json({ events: [] })),
			http.post("/api/tum-ai-days", async ({ request }) => {
				body = (await request.json()) as {
					agenda: string;
					scheduledAt: string;
				};
				return HttpResponse.json(makeEvent({ id: "new-evt" }));
			}),
		);

		const { result } = renderHookWithClient(() => useTumaiDays());
		await waitFor(() => expect(result.current.isLoadingEvents).toBe(false));

		act(() => result.current.setAgenda("New agenda"));
		act(() => result.current.setScheduledAt("2026-09-01T19:00"));
		act(() => {
			result.current.handleSubmit({
				preventDefault: () => {},
			} as React.FormEvent);
		});

		await waitFor(() => expect(result.current.selectedEventId).toBe("new-evt"));
		// datetime-local string is converted to ISO before sending.
		const sent = body as { agenda: string; scheduledAt: string } | null;
		expect(sent?.agenda).toBe("New agenda");
		expect(sent?.scheduledAt).toBe(new Date("2026-09-01T19:00").toISOString());
		expect(showToast).toHaveBeenCalledWith(
			"TUM.ai Day scheduled successfully!",
			"success",
		);
	});

	it("starting an edit prefills the form from the event", async () => {
		server.use(
			http.get("/api/tum-ai-days", () => HttpResponse.json({ events: [] })),
		);
		const event = makeEvent({ agenda: "Edit me" });
		const { result } = renderHookWithClient(() => useTumaiDays());
		await waitFor(() => expect(result.current.isLoadingEvents).toBe(false));

		act(() => {
			result.current.handleStartEdit(event, {
				stopPropagation: () => {},
			} as React.MouseEvent);
		});

		expect(result.current.editingEventId).toBe("evt-1");
		expect(result.current.agenda).toBe("Edit me");
		// Round-trips back to the same instant as the source event.
		expect(new Date(result.current.scheduledAt).toISOString()).toBe(
			event.scheduled_at,
		);

		act(() => result.current.handleCancelEdit());
		expect(result.current.editingEventId).toBeNull();
		expect(result.current.agenda).toBe("");
	});

	it("delete only fires when confirmed", async () => {
		let deleteHit = 0;
		server.use(
			http.get("/api/tum-ai-days", () =>
				HttpResponse.json({ events: [makeEvent()] }),
			),
			http.delete("/api/tum-ai-days/:id", () => {
				deleteHit += 1;
				return new HttpResponse(null, { status: 204 });
			}),
		);
		const { result } = renderHookWithClient(() => useTumaiDays());
		await waitFor(() => expect(result.current.events).toHaveLength(1));

		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
		act(() => {
			result.current.handleDelete("evt-1", {
				stopPropagation: () => {},
			} as React.MouseEvent);
		});
		expect(deleteHit).toBe(0);

		confirmSpy.mockReturnValue(true);
		act(() => {
			result.current.handleDelete("evt-1", {
				stopPropagation: () => {},
			} as React.MouseEvent);
		});
		await waitFor(() => expect(deleteHit).toBe(1));
		confirmSpy.mockRestore();
	});

	it("filters responses by search term and status", async () => {
		server.use(
			http.get("/api/tum-ai-days", () =>
				HttpResponse.json({ events: [makeEvent()] }),
			),
			http.get("/api/tum-ai-days/:id/responses", () =>
				HttpResponse.json({
					event: makeEvent(),
					stats: { yes: 1, no: 1, pending: 0, total: 2 },
					responses: [
						{
							userId: "1",
							givenName: "Ada",
							surname: "Lovelace",
							email: "ada@tum.ai",
							department: "Eng",
							status: "yes",
							reason: null,
							votedAt: null,
						},
						{
							userId: "2",
							givenName: "Alan",
							surname: "Turing",
							email: "alan@tum.ai",
							department: "Eng",
							status: "no",
							reason: "Busy",
							votedAt: null,
						},
					],
				}),
			),
		);

		const { result } = renderHookWithClient(() => useTumaiDays());
		await waitFor(() => expect(result.current.events).toHaveLength(1));
		act(() => result.current.setSelectedEventId("evt-1"));
		await waitFor(() =>
			expect(result.current.filteredResponses).toHaveLength(2),
		);

		act(() => result.current.setSearchTerm("ada"));
		await waitFor(() =>
			expect(result.current.filteredResponses).toHaveLength(1),
		);
		expect(result.current.filteredResponses[0].userId).toBe("1");

		act(() => result.current.setSearchTerm(""));
		act(() => result.current.setStatusFilter("no"));
		await waitFor(() =>
			expect(result.current.filteredResponses).toHaveLength(1),
		);
		expect(result.current.filteredResponses[0].userId).toBe("2");
	});
});
