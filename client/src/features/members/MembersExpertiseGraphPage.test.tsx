import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "@/contexts/ToastContext";
import { HttpResponse, http, server } from "@/test/mswServer";
import { createTestQueryClient } from "@/test/renderWithClient";
import type { Member } from "@/types";
import MembersExpertiseGraphPage from "./MembersExpertiseGraphPage";

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Example",
		given_name: "Member",
		email: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		user_id: crypto.randomUUID(),
		member_status: "active",
		...overrides,
	};
}

const members: Member[] = [
	buildMember({
		user_id: "a",
		given_name: "Ada",
		surname: "Lovelace",
		batch: "WS24",
		expertise_tags: ["machine-learning"],
	}),
	buildMember({
		user_id: "b",
		given_name: "Ben",
		surname: "Board",
		batch: "WS24",
		expertise_tags: ["machine-learning"],
	}),
];

function Providers({ children }: PropsWithChildren): ReactElement {
	const queryClient = createTestQueryClient();
	return (
		<QueryClientProvider client={queryClient}>
			<ToastProvider>{children}</ToastProvider>
		</QueryClientProvider>
	);
}

describe("MembersExpertiseGraphPage", () => {
	it("renders the graph shell, controls, and answers an expertise question", async () => {
		server.use(
			http.get("/api/members", () => HttpResponse.json(members)),
			http.post("/api/members/expertise-query", () =>
				HttpResponse.json({
					answer: "Ada works on machine learning.",
					source: "fallback",
					matches: [
						{ userId: "a", score: 0.9, reason: "Matched: machine-learning" },
					],
				}),
			),
		);

		render(
			<Providers>
				<MembersExpertiseGraphPage />
			</Providers>,
		);

		expect(
			await screen.findByRole("heading", { name: "Expertise Graph" }),
		).toBeInTheDocument();
		// Canvas renders even though jsdom has no 2D context (the draw loop no-ops).
		expect(
			screen.getByRole("img", { name: /member expertise graph/i }),
		).toBeInTheDocument();
		// Reason chips + stats are present.
		expect(
			screen.getByRole("button", { name: "Expertise" }),
		).toBeInTheDocument();

		await userEvent.type(
			screen.getByRole("textbox", { name: /ask about member expertise/i }),
			"Who knows machine learning?",
		);
		await userEvent.click(screen.getByRole("button", { name: "Ask" }));

		// The match resolves its name from the graph nodes and renders a clickable
		// row in the ask panel (distinct from the auto-selected inspector entry).
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /Ada Lovelace/ }),
			).toBeInTheDocument(),
		);
		expect(screen.getByText(/works on machine learning/i)).toBeInTheDocument();
	});
});
