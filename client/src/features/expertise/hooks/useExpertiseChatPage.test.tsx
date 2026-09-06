import type { User } from "@supabase/supabase-js";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useExpertiseChatPage } from "./useExpertiseChatPage";
import { runAssistant } from "./useExpertiseSearch";

const showToast = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin: false }),
}));
vi.mock("./useExpertiseSearch", () => ({ runAssistant: vi.fn() }));

const user = {
	id: "11111111-1111-4111-8111-111111111111",
	email: "ada@example.com",
	user_metadata: { given_name: "ada" },
} as unknown as User;

describe("useExpertiseChatPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("collects validated streamed events into a completed turn", async () => {
		vi.mocked(runAssistant).mockImplementation(async (_request, onEvent) => {
			onEvent({
				type: "tool_call",
				id: "step-1",
				name: "search_members",
				args: { query: "Swift" },
			});
			onEvent({
				type: "answer",
				text: "Ask @[Ada](beacon:11111111-1111-4111-8111-111111111111).",
			});
			onEvent({ type: "done" });
		});
		const { result } = renderHookWithClient(() => useExpertiseChatPage(user));
		await act(async () => {
			await result.current.runConversation("Who knows Swift?", []);
		});
		expect(result.current.messages).toHaveLength(2);
		expect(result.current.messages[1]?.pending).toBe(false);
		expect(result.current.mentionedPeople[0]?.name).toBe("Ada");
	});

	it("shows transport failures inline and as a toast", async () => {
		vi.mocked(runAssistant).mockRejectedValue(new Error("offline"));
		const { result } = renderHookWithClient(() => useExpertiseChatPage(user));
		await act(async () => {
			await result.current.runConversation("Hello", []);
		});
		await waitFor(() =>
			expect(result.current.messages[1]?.text).toContain("offline"),
		);
		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("offline"),
			"error",
		);
	});
});
