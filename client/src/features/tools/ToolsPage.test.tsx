import type { Permission } from "@member-manager/shared";
import { ThemeProvider } from "@mui/material";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import ToolsPage from "./ToolsPage";

const { accessState } = vi.hoisted(() => ({
	accessState: {
		permissions: [] as Permission[],
	},
}));

vi.mock("../../hooks/useToolAccess", () => ({
	useToolAccess: () => ({
		permissions: accessState.permissions,
		isLoading: false,
	}),
}));

function renderToolsPage() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<ToolsPage />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("ToolsPage", () => {
	beforeEach(() => {
		accessState.permissions = [];
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

	it("hides Finance Review without the finance.review permission", () => {
		renderToolsPage();

		expect(
			screen.queryByRole("link", { name: "Finance Review" }),
		).not.toBeInTheDocument();
	});

	it("shows Finance Review with the finance.review permission", () => {
		accessState.permissions = ["finance.review"];

		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Finance Review" }),
		).toHaveAttribute("href", "/tools/reimbursement/review");
	});

	it("hides contract admin tools without the contracts.admin permission", () => {
		accessState.permissions = ["finance.review"];

		renderToolsPage();

		expect(
			screen.queryByRole("link", { name: "Create Contract" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Contract Submissions" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Manage Templates" }),
		).not.toBeInTheDocument();
	});

	it("shows contract admin tools with the contracts.admin permission", () => {
		accessState.permissions = ["contracts.admin"];

		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Create Contract" }),
		).toHaveAttribute("href", "/contracts");
		expect(
			screen.getByRole("link", { name: "Contract Submissions" }),
		).toHaveAttribute("href", "/contracts/submissions");
		expect(
			screen.getByRole("link", { name: "Manage Templates" }),
		).toHaveAttribute("href", "/contracts/templates");
	});

	it("shows all gated tools when every permission is granted", () => {
		accessState.permissions = ["finance.review", "contracts.admin"];

		renderToolsPage();

		expect(
			screen.getByRole("link", { name: "Finance Review" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Contract Submissions" }),
		).toBeInTheDocument();
	});
});
