import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DepartmentReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { DepartmentReimbursementsSection } from "./DepartmentReimbursementsSection";

function request(
	overrides: Partial<DepartmentReimbursementRequest> = {},
): DepartmentReimbursementRequest {
	return {
		id: "department-1",
		requester_name: "Ada Lovelace",
		is_own: false,
		amount: 480,
		date: "2026-04-18",
		description: "Venue deposit",
		submission_type: "invoice",
		status: "requested",
		approval_status: "pending",
		first_approved_at: null,
		payment_status: "to_be_paid",
		created_at: "2026-04-18T10:00:00Z",
		...overrides,
	};
}

const singlePage = {
	page: 1,
	pageCount: 1,
	onPageChange: () => {},
	isChangingPage: false,
};

describe("DepartmentReimbursementsSection", () => {
	it("lists each request with requester, date, amount, type and status", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department="Makeathon"
				requests={[
					request(),
					request({
						id: "department-2",
						is_own: true,
						requester_name: "Grace Hopper",
						description: "Snacks",
						submission_type: "reimbursement",
						status: "paid",
						approval_status: "approved",
						payment_status: "paid",
						amount: 23.4,
						date: "2026-04-02",
					}),
				]}
				isLoading={false}
				error={null}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Makeathon requests" }),
		).toBeInTheDocument();

		const [first, second] = screen.getAllByRole("listitem");
		expect(within(first).getByText("Venue deposit")).toBeInTheDocument();
		expect(
			within(first).getByText("Ada Lovelace · 18 Apr 2026"),
		).toBeInTheDocument();
		expect(within(first).getByText("Invoice")).toBeInTheDocument();
		expect(within(first).getByText("Pending")).toBeInTheDocument();
		expect(within(first).getByText(/480,00/)).toBeInTheDocument();

		// The member's own request is marked as theirs instead of by name.
		expect(within(second).getByText("You · 02 Apr 2026")).toBeInTheDocument();
		expect(within(second).getByText("Paid")).toBeInTheDocument();
	});

	it("falls back when the requester's name is unknown", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department="Makeathon"
				requests={[request({ requester_name: null })]}
				isLoading={false}
				error={null}
			/>,
		);

		expect(
			screen.getByText("Unknown member · 18 Apr 2026"),
		).toBeInTheDocument();
	});

	it("offers no way to open a request, its receipt or its payment details", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department="Makeathon"
				requests={[request()]}
				isLoading={false}
				error={null}
			/>,
		);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("shows no page controls for a single page", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department="Makeathon"
				requests={[request()]}
				isLoading={false}
				error={null}
			/>,
		);

		expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
	});

	it("pages forwards and backwards", async () => {
		const user = userEvent.setup();
		const onPageChange = vi.fn();
		render(
			<DepartmentReimbursementsSection
				department="Makeathon"
				requests={[request()]}
				page={2}
				pageCount={3}
				onPageChange={onPageChange}
				isChangingPage={false}
				isLoading={false}
				error={null}
			/>,
		);

		const pages = within(
			screen.getByRole("navigation", { name: "Department requests pages" }),
		);
		expect(pages.getByText("Page 2 of 3")).toBeInTheDocument();

		await user.click(pages.getByRole("link", { name: "Go to next page" }));
		expect(onPageChange).toHaveBeenLastCalledWith(3);
		await user.click(pages.getByRole("link", { name: "Go to previous page" }));
		expect(onPageChange).toHaveBeenLastCalledWith(1);
	});

	it("disables Previous on the first page and Next on the last", () => {
		const { rerender } = render(
			<DepartmentReimbursementsSection
				department="Makeathon"
				requests={[request()]}
				page={1}
				pageCount={2}
				onPageChange={() => {}}
				isChangingPage={false}
				isLoading={false}
				error={null}
			/>,
		);

		const previous = () =>
			screen.getByRole("link", { name: "Go to previous page" });
		const next = () => screen.getByRole("link", { name: "Go to next page" });
		expect(previous()).toHaveAttribute("aria-disabled", "true");
		expect(previous()).not.toHaveAttribute("href");
		expect(next()).not.toHaveAttribute("aria-disabled");

		rerender(
			<DepartmentReimbursementsSection
				department="Makeathon"
				requests={[request()]}
				page={2}
				pageCount={2}
				onPageChange={() => {}}
				isChangingPage={false}
				isLoading={false}
				error={null}
			/>,
		);

		expect(next()).toHaveAttribute("aria-disabled", "true");
		expect(previous()).not.toHaveAttribute("aria-disabled");
	});

	it("marks the list busy while another page loads", () => {
		render(
			<DepartmentReimbursementsSection
				department="Makeathon"
				requests={[request()]}
				page={1}
				pageCount={2}
				onPageChange={() => {}}
				isChangingPage
				isLoading={false}
				error={null}
			/>,
		);

		expect(screen.getByRole("list", { busy: true })).toBeInTheDocument();
	});

	it("says when the department has no requests yet", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department="Makeathon"
				requests={[]}
				isLoading={false}
				error={null}
			/>,
		);

		expect(
			screen.getByText("No requests for your department yet."),
		).toBeInTheDocument();
	});

	it("shows a loading state before the department is known", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department={null}
				requests={[]}
				isLoading
				error={null}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Department requests" }),
		).toBeInTheDocument();
		expect(screen.getByText("Loading department requests")).toBeInTheDocument();
		expect(screen.queryByRole("list")).not.toBeInTheDocument();
	});

	it("reports a failed load", () => {
		render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department={null}
				requests={[]}
				isLoading={false}
				error={new Error("Database unavailable")}
			/>,
		);

		expect(
			screen.getByText(
				"Error loading department requests: Database unavailable",
			),
		).toBeInTheDocument();
	});

	it("renders nothing for a member without a department", () => {
		const { container } = render(
			<DepartmentReimbursementsSection
				{...singlePage}
				department={null}
				requests={[]}
				isLoading={false}
				error={null}
			/>,
		);

		expect(container).toBeEmptyDOMElement();
	});
});
