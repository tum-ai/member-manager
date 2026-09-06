import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import type { Member } from "@/types";
import MembersOrgChartPage from "./MembersOrgChartPage";

const { membersState } = vi.hoisted(() => ({
	membersState: {
		members: [] as Member[],
		isLoading: false,
		error: null as Error | null,
	},
}));

vi.mock("../../hooks/useMembersListData", () => ({
	useMembersListData: () => membersState,
}));

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "President",
		given_name: "Paula",
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

describe("MembersOrgChartPage", () => {
	beforeEach(() => {
		membersState.members = [];
		membersState.isLoading = false;
		membersState.error = null;
	});

	it("publishes the org chart header", () => {
		membersState.members = [
			buildMember({ department: null, member_role: "President" }),
		];
		renderWithClient(<MembersOrgChartPage />);
		expect(
			screen.getByRole("heading", { name: /org chart/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Overview of current leadership and departments."),
		).toBeInTheDocument();
	});

	it("shows an error message on failure", () => {
		membersState.error = new Error("boom");
		renderWithClient(<MembersOrgChartPage />);
		expect(screen.getByText(/failed to load members/i)).toBeInTheDocument();
	});
});
