import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminMember } from "@/features/admin/adminUtils";

import { AdminMembersTable } from "./AdminMembersTable";

const member = {
	user_id: "m1",
	given_name: "Alice",
	surname: "Example",
	email: "alice@example.com",
	department: "Software Development",
	member_role: "Member",
	board_role: null,
	member_status: "active",
	active: true,
	phone: "+49 123",
	public_location: "Munich",
	linkedin_profile_url: "https://linkedin.com/in/alice",
	avatar_url: null,
	sepa: {
		iban: "DE00 1234",
		bic: "BICCODE",
		bank_name: "Test Bank",
		mandate_agreed: true,
		privacy_agreed: false,
		data_privacy_notice_agreed: true,
	},
} as unknown as AdminMember;

function renderTable(
	overrides: Partial<React.ComponentProps<typeof AdminMembersTable>> = {},
) {
	const props: React.ComponentProps<typeof AdminMembersTable> = {
		rows: [member],
		sortBy: "surname",
		sortAsc: true,
		onSortChange: vi.fn(),
		onEditMember: vi.fn(),
		loadingMessage: "Showing 1 member",
		...overrides,
	};
	render(<AdminMembersTable {...props} />);
	return props;
}

describe("AdminMembersTable", () => {
	it("renders a member's core data and banking details", () => {
		renderTable();

		expect(screen.getByText("Alice Example")).toBeInTheDocument();
		expect(screen.getByText("alice@example.com")).toBeInTheDocument();
		expect(screen.getByText("DE00 1234")).toBeInTheDocument();
		expect(screen.getByText("Test Bank")).toBeInTheDocument();
		expect(screen.getByText("Showing 1 member")).toBeInTheDocument();
	});

	it("renders agreement chips reflecting each agreement state", () => {
		renderTable();

		// SEPA + data-privacy accepted, privacy not accepted.
		expect(screen.getAllByRole("img", { name: "Accepted" })).toHaveLength(2);
		expect(screen.getAllByRole("img", { name: "Not accepted" })).toHaveLength(
			1,
		);
	});

	it("invokes the edit callback for the row", async () => {
		const user = userEvent.setup();
		const props = renderTable();

		await user.click(
			screen.getByRole("button", { name: /edit member alice example/i }),
		);

		expect(props.onEditMember).toHaveBeenCalledWith(member);
	});

	it("sorts when a column header is clicked", async () => {
		const user = userEvent.setup();
		const props = renderTable();

		await user.click(screen.getByRole("button", { name: /department/i }));

		expect(props.onSortChange).toHaveBeenCalledWith("department");
	});

	it("shows an empty state when there are no rows", () => {
		renderTable({ rows: [] });

		expect(
			screen.getByText(/no members match the current filters/i),
		).toBeInTheDocument();
	});
});
