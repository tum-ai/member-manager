import type { User } from "@supabase/supabase-js";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import ExpertiseChatPage from "./ExpertiseChatPage";

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin: false }),
}));

const user = {
	id: "11111111-1111-4111-8111-111111111111",
	email: "ada@example.com",
	user_metadata: { given_name: "Ada" },
} as unknown as User;

describe("ExpertiseChatPage", () => {
	it("keeps the app header as the sole page-level heading", async () => {
		renderWithClient(<ExpertiseChatPage user={user} />);
		expect(
			await screen.findByRole("heading", { name: "Agent", level: 1 }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", {
				name: "Good to see you, Ada.",
				level: 2,
			}),
		).toBeInTheDocument();
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});
});
