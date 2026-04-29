import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import getAppTheme from "../../theme";
import type { InnovationProject, Member } from "../../types";
import OrgChartView from "./OrgChartView";

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

describe("OrgChartView", () => {
	it("shows board responsibilities at the top and keeps department homes", () => {
		render(
			<ThemeProvider theme={getAppTheme("light")}>
				<OrgChartView
					members={[
						buildMember({
							user_id: "president",
							given_name: "Paula",
							surname: "President",
							department: null,
							member_role: "President",
						}),
						buildMember({
							user_id: "lead",
							given_name: "Taylor",
							surname: "Lead",
							department: "Software Development",
							member_role: "Team Lead",
						}),
						buildMember({
							user_id: "member",
							given_name: "Alice",
							surname: "Builder",
							department: "Software Development",
							member_role: "Member",
							board_role: "Board Member",
						}),
						buildMember({
							user_id: "board-member",
							given_name: "Boris",
							surname: "Board",
							department: "Software Development",
							member_role: "Member",
							board_role: "Board Member",
						}),
					]}
				/>
			</ThemeProvider>,
		);

		expect(
			screen.getByRole("heading", { name: /org chart/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Overview of current leadership, departments and research.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Board Members")).toBeInTheDocument();
		expect(screen.getByText("Paula President")).toBeInTheDocument();
		expect(screen.getAllByText("Boris Board")).toHaveLength(2);
		expect(screen.getByText("Software Development")).toBeInTheDocument();
		expect(
			screen.queryByLabelText(/show board responsibilities/i),
		).not.toBeInTheDocument();
		expect(screen.getAllByText("Alice Builder")).toHaveLength(2);
		expect(screen.getAllByText("Board member")).toHaveLength(2);
	});

	it("shows board members without operational role text or board badges in the board section", () => {
		render(
			<ThemeProvider theme={getAppTheme("light")}>
				<OrgChartView
					members={[
						buildMember({
							user_id: "finance-lead",
							given_name: "Linus",
							surname: "Finance",
							department: "Legal & Finance",
							member_role: "Team Lead",
							board_role: "Board Member",
						}),
					]}
				/>
			</ThemeProvider>,
		);

		expect(screen.getAllByText("Linus Finance")).toHaveLength(2);
		expect(screen.getAllByText("Team Lead")).toHaveLength(1);
		expect(screen.getAllByText("Board member")).toHaveLength(1);
	});

	it("shows research projects below departments and expands details on click", async () => {
		const user = userEvent.setup();
		render(
			<ThemeProvider theme={getAppTheme("light")}>
				<OrgChartView
					members={[
						buildMember({
							user_id: "department-lead",
							given_name: "Taylor",
							surname: "Lead",
							department: "Software Development",
							member_role: "Team Lead",
						}),
						buildMember({
							user_id: "research-lead",
							given_name: "Lea",
							surname: "Research",
							department: "Research",
							member_role: "Team Lead",
							research_project_id: "project-a",
						}),
						buildMember({
							user_id: "research-member",
							given_name: "Riley",
							surname: "Research",
							department: "Research",
							member_role: "Member",
							research_project_id: "project-a",
						}),
					]}
					researchProjects={[
						{
							id: "project-a",
							title: "Alpha Research",
							description: "Current project",
							status: "ongoing",
						},
					]}
				/>
			</ThemeProvider>,
		);

		expect(screen.getByText("Research Projects")).toBeInTheDocument();
		expect(screen.getByText("Alpha Research")).toBeInTheDocument();
		expect(screen.getByText("Software Development")).toBeInTheDocument();
		expect(
			screen
				.getByText("Research Projects")
				.compareDocumentPosition(screen.getByText("Software Development")) &
				Node.DOCUMENT_POSITION_PRECEDING,
		).toBeTruthy();
		expect(screen.queryByText("Lea Research")).not.toBeInTheDocument();
		expect(screen.queryByText("Riley Research")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /alpha research/i }));

		expect(screen.getByText("Lea Research")).toBeInTheDocument();
		expect(screen.getByText("Riley Research")).toBeInTheDocument();
	});

	it("shows innovation projects below departments and expands details on click", async () => {
		const user = userEvent.setup();
		const innovationProjects: InnovationProject[] = [
			{
				id: "women-at-tumai",
				title: "Women@TUM.ai",
				description: "Female empowerment, mentorship, and leadership.",
				detailedDescription:
					"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative.",
				image: "/assets/innovation/women_at_tumai.jpg",
			},
		];

		render(
			<ThemeProvider theme={getAppTheme("light")}>
				<OrgChartView
					members={[
						buildMember({
							user_id: "department-lead",
							given_name: "Taylor",
							surname: "Lead",
							department: "Software Development",
							member_role: "Team Lead",
						}),
						buildMember({
							user_id: "innovation-lead",
							given_name: "Iris",
							surname: "Innovation",
							department: "Marketing",
							member_role: "Member",
							innovation_project_id: "women-at-tumai",
							innovation_project_role: "Lead",
						}),
						buildMember({
							user_id: "innovation-member",
							given_name: "Ivan",
							surname: "Innovation",
							department: "Software Development",
							member_role: "Team Lead",
							innovation_project_id: "women-at-tumai",
						}),
					]}
					innovationProjects={innovationProjects}
				/>
			</ThemeProvider>,
		);

		expect(screen.getByText("Innovation Projects")).toBeInTheDocument();
		expect(screen.getByText("Women@TUM.ai")).toBeInTheDocument();
		expect(screen.getByText("Software Development")).toBeInTheDocument();
		expect(screen.getByText("Marketing")).toBeInTheDocument();
		expect(
			screen
				.getByText("Innovation Projects")
				.compareDocumentPosition(screen.getByText("Software Development")) &
				Node.DOCUMENT_POSITION_PRECEDING,
		).toBeTruthy();
		expect(
			screen.queryByText(
				"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative.",
			),
		).not.toBeInTheDocument();
		expect(screen.getAllByText("Iris Innovation")).toHaveLength(1);
		expect(screen.getAllByText("Ivan Innovation")).toHaveLength(1);

		await user.click(screen.getByRole("button", { name: /women@tum\.ai/i }));

		expect(
			screen.getByText(
				"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Project Leads")).toBeInTheDocument();
		expect(screen.getAllByText("Iris Innovation")).toHaveLength(2);
		expect(screen.getAllByText("Ivan Innovation")).toHaveLength(2);
	});
});
