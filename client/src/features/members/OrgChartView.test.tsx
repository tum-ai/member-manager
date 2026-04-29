import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import getAppTheme from "../../theme";
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
	it("shows board members without internal member-role labels", () => {
		render(
			<ThemeProvider theme={getAppTheme("light")}>
				<OrgChartView
					members={[
						buildMember({
							user_id: "president",
							given_name: "Paula",
							surname: "President",
							department: "Legal & Finance",
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
		expect(screen.getAllByText("Board").length).toBeGreaterThan(0);
		expect(screen.getByText("Paula President")).toBeInTheDocument();
		expect(screen.getAllByText("Boris Board")).toHaveLength(2);
		expect(screen.getByText("Software Development")).toBeInTheDocument();
		expect(screen.getAllByText("Member")).toHaveLength(2);
	});
});
