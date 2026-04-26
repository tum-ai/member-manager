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
				given_name: "Ben",
				surname: "Boardmember",
				department: "Board",
				member_role: "Member",
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
				board_role: "Board Member",
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

vi.mock("../../hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({
		researchProjects: [
			{
				id: "project-a",
				title: "Alpha Research",
				description: "Current project",
				status: "ongoing",
			},
		],
		isLoading: false,
		error: null,
	}),
}));

vi.mock("../../hooks/useInnovationProjects", () => ({
	useInnovationProjects: () => ({
		innovationProjects: [
			{
				id: "women-at-tum-ai",
				title: "Women@TUM.ai",
				description: "Female empowerment and mentorship.",
				detailedDescription:
					"Women@TUM.ai builds a space where female students can connect.",
				image: "/assets/innovation/women_at_tumai.jpg",
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
		expect(screen.queryByText("Ben Boardmember")).not.toBeInTheDocument();
		expect(screen.queryByText("Carla Example")).not.toBeInTheDocument();
	});

	it("renders an org chart from the filtered member data", async () => {
		const user = userEvent.setup();
		renderMemberList();

		expect(
			screen.getByRole("heading", { name: /org chart/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Overview of current leadership, departments and research.",
			),
		).toBeInTheDocument();
		expect(
			screen
				.getByRole("heading", { name: /all members/i })
				.compareDocumentPosition(
					screen.getByRole("heading", { name: /org chart/i }),
				) & Node.DOCUMENT_POSITION_PRECEDING,
		).toBeTruthy();
		expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Software Development").length).toBeGreaterThan(
			0,
		);
		expect(screen.getByText("Innovation Projects")).toBeInTheDocument();
		expect(screen.getByText("Women@TUM.ai")).toBeInTheDocument();
		expect(screen.getAllByText("Ben Boardmember")).toHaveLength(2);
		expect(screen.getAllByText("Board Member").length).toBeGreaterThanOrEqual(
			2,
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

	it("shows board-only members as board members without member role text", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.type(screen.getByPlaceholderText(/search members/i), "Ben");

		expect(screen.getAllByText("Ben Boardmember")).toHaveLength(2);
		expect(screen.getByText("Board Member")).toBeInTheDocument();
		expect(screen.queryByText("Member")).not.toBeInTheDocument();
	});
});
