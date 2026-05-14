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
				department: null,
				member_role: "Member",
				board_role: "Board Member",
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
				department: "Research",
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

		await user.click(screen.getByRole("combobox", { name: /degree/i }));
		await user.click(await screen.findByRole("option", { name: "B.Sc." }));

		await user.click(
			screen.getByRole("combobox", { name: /major \/ program/i }),
		);
		await user.click(
			await screen.findByRole("option", { name: "Computer Science" }),
		);

		expect(screen.getAllByText("Alice Example").length).toBeGreaterThan(0);
		expect(screen.queryByText("Ben Boardmember")).not.toBeInTheDocument();
		expect(screen.queryByText("Carla Example")).not.toBeInTheDocument();
	});

	it("renders an interactive member graph from the filtered member data", async () => {
		const user = userEvent.setup();
		renderMemberList();

		expect(
			screen.getByRole("heading", {
				name: /search, then follow the connections/i,
			}),
		).toBeInTheDocument();
		expect(screen.getByText(/focused map of members/i)).toBeInTheDocument();
		expect(
			screen
				.getByRole("heading", { name: /all members/i })
				.compareDocumentPosition(
					screen.getByRole("heading", {
						name: /search, then follow the connections/i,
					}),
				) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /discover next/i }),
		).toBeEnabled();
		expect(
			screen.getByPlaceholderText(/search the member graph/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /focus alice example/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /focus ben boardmember/i }),
		).toBeInTheDocument();
		expect(screen.queryByText("Research")).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: /focus ben boardmember/i }),
		);

		expect(screen.getAllByText("Ben Boardmember").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Board member").length).toBeGreaterThanOrEqual(
			2,
		);

		await user.type(
			screen.getByPlaceholderText(/search the member graph/i),
			"Carla",
		);

		expect(screen.getByText(/1 match in current filters/i)).toBeInTheDocument();
		expect(
			screen.getByText(/people matching your search/i),
		).toBeInTheDocument();

		await user.clear(screen.getByPlaceholderText(/search the member graph/i));

		await user.click(screen.getByRole("combobox", { name: /degree/i }));
		await user.click(await screen.findByRole("option", { name: "B.Sc." }));

		await user.click(
			screen.getByRole("combobox", { name: /major \/ program/i }),
		);
		await user.click(
			await screen.findByRole("option", { name: "Computer Science" }),
		);

		expect(screen.getAllByText("Software Development").length).toBeGreaterThan(
			0,
		);
		expect(screen.queryByText("Carla Example")).not.toBeInTheDocument();
	});

	it("does not expose Board or Research in the department filter", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.click(screen.getByRole("combobox", { name: /department/i }));

		expect(
			screen.queryByRole("option", { name: "Board" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Research" }),
		).not.toBeInTheDocument();
		expect(screen.getAllByText("Board member").length).toBeGreaterThan(0);
	});

	it("shows board-only members as board members without member role text", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.type(screen.getByPlaceholderText(/search members/i), "Ben");

		expect(screen.getAllByText("Ben Boardmember").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Board member").length).toBeGreaterThan(0);
		expect(screen.queryByText("Member")).not.toBeInTheDocument();
	});
});
