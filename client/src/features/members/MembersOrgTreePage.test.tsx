import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "../../types";
import MembersOrgTreePage from "./MembersOrgTreePage";

const { membersState, diagramNodes, mobileState } = vi.hoisted(() => ({
	membersState: {
		members: [] as Member[],
		isLoading: false,
		error: null as Error | null,
	},
	diagramNodes: { current: null as unknown },
	mobileState: { isMobile: false },
}));

vi.mock("../../hooks/useMembersListData", () => ({
	useMembersListData: () => membersState,
}));

vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => mobileState.isMobile,
}));

// d3-org-chart's SVG/zoom rendering is unreliable under jsdom — assert the page
// wiring instead and capture the nodes the diagram would receive.
vi.mock("./orgTree/OrgChartDiagram", () => ({
	OrgChartDiagram: ({ nodes }: { nodes: unknown }) => {
		diagramNodes.current = nodes;
		return <div data-testid="org-chart-diagram" />;
	},
}));

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Lead",
		given_name: "Team",
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

describe("MembersOrgTreePage", () => {
	beforeEach(() => {
		membersState.members = [];
		membersState.isLoading = false;
		membersState.error = null;
		diagramNodes.current = null;
		mobileState.isMobile = false;
	});

	it("shows a spinner while loading", () => {
		membersState.isLoading = true;
		render(<MembersOrgTreePage />);
		expect(screen.getByText(/loading org tree/i)).toBeInTheDocument();
	});

	it("shows an error message on failure", () => {
		membersState.error = new Error("boom");
		render(<MembersOrgTreePage />);
		expect(screen.getByText(/failed to load members/i)).toBeInTheDocument();
	});

	it("renders the header and feeds a built node tree to the diagram", () => {
		membersState.members = [
			buildMember({ member_role: "Team Lead", department: "Marketing" }),
		];
		render(<MembersOrgTreePage />);
		expect(
			screen.getByRole("heading", { name: "Org Tree" }),
		).toBeInTheDocument();
		expect(screen.getByTestId("org-chart-diagram")).toBeInTheDocument();
		const nodes = diagramNodes.current as { id: string }[];
		expect(nodes.some((n) => n.id === "board")).toBe(true);
		expect(nodes.some((n) => n.id === "dept:Marketing")).toBe(true);
	});

	it("redirects to the org chart on mobile", () => {
		mobileState.isMobile = true;
		render(
			<MemoryRouter initialEntries={["/members/org-tree"]}>
				<Routes>
					<Route path="/members/org-tree" element={<MembersOrgTreePage />} />
					<Route
						path="/members/org-chart"
						element={<div data-testid="org-chart-page" />}
					/>
				</Routes>
			</MemoryRouter>,
		);
		expect(screen.getByTestId("org-chart-page")).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Org Tree" }),
		).not.toBeInTheDocument();
	});
});
