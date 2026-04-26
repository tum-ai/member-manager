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
	it("shows leadership and omits non-executive board members", () => {
		render(
			<ThemeProvider theme={getAppTheme("light")}>
				<OrgChartView
					members={[
						buildMember({
							user_id: "president",
							given_name: "Paula",
							surname: "President",
							department: "Board",
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
							department: "Board",
							member_role: "Member",
						}),
					]}
				/>
			</ThemeProvider>,
		);

		expect(
			screen.getByRole("heading", { name: /org chart/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Leadership")).toBeInTheDocument();
		expect(screen.getByText("Paula President")).toBeInTheDocument();
		expect(screen.getByText("Software Development")).toBeInTheDocument();
		expect(screen.queryByText("Boris Board")).not.toBeInTheDocument();
	});
});
