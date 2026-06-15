import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Member } from "../../types";
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
			/>,
		);

		expect(
			screen.getByRole("heading", { name: /org chart/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Overview of current leadership and departments."),
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
			/>,
		);

		expect(screen.getAllByText("Linus Finance")).toHaveLength(2);
		expect(screen.queryByText("Team Lead")).not.toBeInTheDocument();
		expect(screen.getAllByText("Board member")).toHaveLength(1);
	});
});
