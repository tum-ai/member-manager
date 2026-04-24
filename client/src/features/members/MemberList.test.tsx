import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import MemberList from "./MemberList";

vi.mock("../../hooks/useMembersListData", () => ({
	useMembersListData: () => ({
		members: [
			{
				user_id: "member-1",
				given_name: "Alice",
				surname: "Example",
				department: "Software Development",
				member_role: "Member",
				degree: "B.Sc. Computer Science",
				school: "TUM",
				batch: "WS25",
				member_status: "active",
				active: true,
			},
			{
				user_id: "member-2",
				given_name: "Bob",
				surname: "Example",
				department: "Board",
				member_role: "Team Lead",
				degree: "M.Sc. Management & Technology",
				school: "TUM",
				batch: "SS25",
				member_status: "active",
				active: true,
			},
			{
				user_id: "member-3",
				given_name: "Carla",
				surname: "Example",
				department: "Marketing",
				member_role: "Member",
				degree: "B.Sc. Management & Technology",
				school: "LMU",
				batch: "WS24",
				member_status: "active",
				active: true,
			},
		],
		isLoading: false,
		error: null,
	}),
}));

function renderMemberList() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<MemberList />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("MemberList", () => {
	it("filters members by degree type and major/program", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.click(screen.getByLabelText(/degree/i));
		await user.click(await screen.findByRole("option", { name: "B.Sc." }));

		await user.click(screen.getByLabelText(/major \/ program/i));
		await user.click(
			await screen.findByRole("option", { name: "Computer Science" }),
		);

		expect(screen.getAllByText("Alice Example").length).toBeGreaterThan(0);
		expect(screen.queryByText("Bob Example")).not.toBeInTheDocument();
		expect(screen.queryByText("Carla Example")).not.toBeInTheDocument();
	});

	it("renders an org chart from the filtered member data", async () => {
		const user = userEvent.setup();
		renderMemberList();

		expect(
			screen.getByRole("heading", { name: /org chart/i }),
		).toBeInTheDocument();
		expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Software Development").length).toBeGreaterThan(
			0,
		);

		await user.click(screen.getByLabelText(/degree/i));
		await user.click(await screen.findByRole("option", { name: "B.Sc." }));

		await user.click(screen.getByLabelText(/major \/ program/i));
		await user.click(
			await screen.findByRole("option", { name: "Computer Science" }),
		);

		expect(screen.getAllByText("Software Development").length).toBeGreaterThan(
			0,
		);
		expect(screen.queryByText("Marketing")).not.toBeInTheDocument();
	});
});
