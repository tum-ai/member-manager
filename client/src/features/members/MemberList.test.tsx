import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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
				degree: "Bachelor Computer Science\nMaster Data Science",
				school: "TUM\nLMU",
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
				degree: "Master Management & Technology",
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
				degree: "Bachelor Management & Technology",
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
		<MemoryRouter>
			<MemberList />
		</MemoryRouter>,
	);
}

describe("MemberList", () => {
	it("filters members by degree type and major/program", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.click(screen.getByLabelText(/degree/i));
		await user.click(await screen.findByRole("option", { name: "Bachelor" }));

		await user.click(screen.getByLabelText(/major \/ program/i));
		await user.click(
			await screen.findByRole("option", { name: "Computer Science" }),
		);

		expect(screen.getAllByText("Alice Example").length).toBeGreaterThan(0);
		expect(screen.queryByText("Ben Boardmember")).not.toBeInTheDocument();
		expect(screen.queryByText("Carla Example")).not.toBeInTheDocument();
	});

	it("filters members by a second current study", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.click(screen.getByLabelText(/degree/i));
		await user.click(await screen.findByRole("option", { name: "Master" }));

		await user.click(screen.getByLabelText(/major \/ program/i));
		await user.click(
			await screen.findByRole("option", { name: "Data Science" }),
		);

		expect(screen.getAllByText("Alice Example").length).toBeGreaterThan(0);
		expect(screen.queryByText("Ben Boardmember")).not.toBeInTheDocument();
		expect(screen.queryByText("Carla Example")).not.toBeInTheDocument();
	});

	it("exposes Research but not Board in the department filter", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.click(screen.getByLabelText(/department/i));

		expect(
			screen.queryByRole("option", { name: "Board" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Research" }),
		).toBeInTheDocument();
		expect(screen.getAllByText("Board member").length).toBeGreaterThan(0);
	});

	it("matches member names in first-last and last-first order", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.type(
			screen.getByPlaceholderText(/search members/i),
			"Example Alice",
		);

		expect(screen.getAllByText("Alice Example").length).toBeGreaterThan(0);
		expect(screen.queryByText("Ben Boardmember")).not.toBeInTheDocument();
	});

	it("shows board-only members as board members without member role text", async () => {
		const user = userEvent.setup();
		renderMemberList();

		await user.type(screen.getByPlaceholderText(/search members/i), "Ben");

		expect(screen.getByText("Ben Boardmember")).toBeInTheDocument();
		expect(screen.getByText("Board member")).toBeInTheDocument();
		expect(screen.queryByText("Member")).not.toBeInTheDocument();
	});
});
