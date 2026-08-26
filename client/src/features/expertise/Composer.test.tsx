import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import { Composer } from "./Composer";

const PERSON_ID = "11111111-1111-4111-8111-111111111111";

describe("Composer", () => {
	it("supports keyboard mention selection and submits bound mentions", async () => {
		server.use(
			http.get("/api/expertise/people", () =>
				HttpResponse.json({
					people: [
						{ user_id: PERSON_ID, name: "Ada Lovelace", avatar_url: null },
					],
				}),
			),
		);
		const onSubmit = vi.fn();
		renderWithClient(<Composer onSubmit={onSubmit} />);
		const user = userEvent.setup();
		const input = screen.getByRole("textbox", { name: "Ask Beacon" });
		await user.type(input, "Ask @ad");
		const option = await screen.findByRole("option", { name: /Ada Lovelace/ });
		expect(input).toHaveAttribute("aria-activedescendant", option.id);
		expect(screen.getByRole("status")).toHaveTextContent(
			"1 member suggestion available. Ada Lovelace selected.",
		);
		await user.keyboard("{Enter}");
		expect(input).toHaveValue("Ask @Ada Lovelace ");
		await user.type(input, "about Swift");
		await user.click(screen.getByRole("button", { name: "Send message" }));
		expect(onSubmit).toHaveBeenCalledWith("Ask @Ada Lovelace about Swift", [
			{ user_id: PERSON_ID, label: "Ada Lovelace" },
		]);
	});

	it("announces mention search failures", async () => {
		server.use(
			http.get("/api/expertise/people", () =>
				HttpResponse.json(
					{ message: "Directory unavailable" },
					{ status: 500 },
				),
			),
		);
		renderWithClient(<Composer onSubmit={() => {}} />);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Ask Beacon" }),
			"@ad",
		);
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Directory unavailable",
			),
		);
	});
});
