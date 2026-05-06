import { ThemeProvider } from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import ToolsPage from "./ToolsPage";

const { memberState, adminState } = vi.hoisted(() => ({
	memberState: {
		member: {
			user_id: "user-123",
			active: true,
			member_status: "active",
			department: "Software Development",
		},
	},
	adminState: {
		isAdmin: false,
	},
}));

vi.mock("../../hooks/useMemberData", () => ({
	useMemberData: () => ({
		member: memberState.member,
	}),
}));

vi.mock("../../hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({
		isAdmin: adminState.isAdmin,
		isLoading: false,
	}),
}));

const mockUser = {
	id: "user-123",
	email: "user@test.com",
} as User;

function renderToolsPage() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<ToolsPage user={mockUser} />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("ToolsPage", () => {
	beforeEach(() => {
		adminState.isAdmin = false;
		memberState.member = {
			user_id: "user-123",
			active: true,
			member_status: "active",
			department: "Software Development",
		};
	});

	it("renders the reimbursement tool link with the correct href", () => {
		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Reimbursement Tool" }),
		).toHaveAttribute("href", "/tools/reimbursement");
	});

	it("renders the engagement certificate link with the correct href", () => {
		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Engagement Certificate" }),
		).toHaveAttribute("href", "/tools/engagement-certificate");
	});

	it("groups tools by use case without the old member tools badge", () => {
		renderToolsPage();

		expect(screen.queryByText("Member tools")).not.toBeInTheDocument();
		expect(
			screen.queryByText(/Self-service documents and member workflows/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(
				/Fast access to operational workflows for active TUM.ai members/i,
			),
		).not.toBeInTheDocument();

		const financeGroup = screen.getByRole("region", { name: /finance/i });
		expect(
			within(financeGroup).getByRole("link", { name: "Reimbursement Tool" }),
		).toBeInTheDocument();

		const generalGroup = screen.getByRole("region", { name: /general/i });
		expect(
			within(generalGroup).getByRole("link", {
				name: "Engagement Certificate",
			}),
		).toBeInTheDocument();
	});

	it("hides Finance Review when the member cannot use it", () => {
		renderToolsPage();

		expect(
			screen.queryByRole("link", { name: "Finance Review" }),
		).not.toBeInTheDocument();
	});

	it("shows Finance Review for active Legal & Finance members", () => {
		memberState.member = {
			user_id: "user-123",
			active: true,
			member_status: "active",
			department: "Legal & Finance",
		};

		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Finance Review" }),
		).toHaveAttribute("href", "/tools/reimbursement/review");
	});

	it("shows Finance Review for admins", () => {
		adminState.isAdmin = true;

		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Finance Review" }),
		).toHaveAttribute("href", "/tools/reimbursement/review");
	});
});
