import type {
	BuchhaltungsButlerTransaction,
	FinancePlanItem,
	FinanceProject,
} from "@member-manager/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { ReimbursementFinanceLinkEditor } from "./ReimbursementFinanceLinkEditor";

const project = {
	id: "10000000-0000-4000-8000-000000000001",
	parent_project_id: null,
	name: "Makeathon 2026",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	tax_area: "wirtschaftlich",
	target_amount: 12000,
	status: "active",
	description: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
} satisfies FinanceProject;

const otherProject = {
	...project,
	id: "10000000-0000-4000-8000-000000000002",
	name: "Makeathon 2027",
	period_key: "2027",
} satisfies FinanceProject;

const planItem = {
	id: "30000000-0000-4000-8000-000000000001",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	label: "Prototype materials",
	category: null,
	planned_amount: 500,
	expected_month: "2026-05",
	status: "planned",
	note: null,
} satisfies FinancePlanItem;

const request = {
	id: "request-1",
	department: "Makeathon",
	finance_project_id: null,
	finance_plan_item_id: null,
	bb_posting_external_id: null,
} as ReimbursementRequest;

const posting = {
	external_id: "BB-1001",
	date: "2026-04-12",
	postingtext: "Workshop supplies",
	amount: -42.5,
	currency: "EUR",
	vat: 19,
	credit_type: "debit",
	debit_postingaccount_number: "6840",
	credit_postingaccount_number: "1200",
	cost_location: "110",
	cost_location_two: "4",
	transaction_amount: -42.5,
	transaction_purpose: "Onboarding workshop",
} satisfies BuchhaltungsButlerTransaction;

describe("ReimbursementFinanceLinkEditor", () => {
	it("filters finance options to the request department and saves all links explicitly", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn().mockResolvedValue(undefined);
		renderWithClient(
			<ReimbursementFinanceLinkEditor
				request={request}
				projects={[
					project,
					otherProject,
					{ ...project, id: "project-community", department: "Community" },
				]}
				planItems={[
					planItem,
					{ ...planItem, id: "plan-2027", period_key: "2027" },
					{ ...planItem, id: "plan-community", department: "Community" },
				]}
				postings={[posting]}
				disabled={false}
				onSave={onSave}
			/>,
		);

		await user.click(screen.getByLabelText("Finance project"));
		expect(
			await screen.findByRole("option", { name: "Makeathon 2026" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: /Community/ }),
		).not.toBeInTheDocument();
		await user.keyboard("{Escape}");
		await user.click(screen.getByLabelText("Finance plan item"));
		expect(
			await screen.findByRole("option", {
				name: "Prototype materials (2026)",
			}),
		).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: /Community/ })).toBeNull();
		await user.click(
			screen.getByRole("option", { name: "Prototype materials (2026)" }),
		);
		await user.click(screen.getByLabelText("BB posting"));
		await user.click(await screen.findByText("2026-04-12 · Workshop supplies"));
		await user.click(screen.getByRole("button", { name: "Save links" }));

		expect(onSave).toHaveBeenCalledWith(null, planItem.id, "BB-1001");
	});

	it("only offers plan items compatible with the selected project", async () => {
		const user = userEvent.setup();
		renderWithClient(
			<ReimbursementFinanceLinkEditor
				request={{ ...request, finance_project_id: project.id }}
				projects={[project, otherProject]}
				planItems={[
					{
						...planItem,
						id: "plan-matching",
						label: "Matching item",
						project_id: project.id,
					},
					{
						...planItem,
						id: "plan-other-project",
						label: "Other project item",
						project_id: otherProject.id,
					},
					{
						...planItem,
						id: "plan-unassigned",
						label: "Unassigned item",
						project_id: null,
					},
					{
						...planItem,
						id: "plan-unknown-project",
						label: "Unknown item",
					},
				]}
				postings={[posting]}
				disabled={false}
				onSave={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		await user.click(screen.getByLabelText("Finance plan item"));

		expect(
			await screen.findByRole("option", { name: "Matching item (2026)" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Unassigned item (2026)" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Other project item (2026)" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Unknown item (2026)" }),
		).not.toBeInTheDocument();
	});

	it("clears an existing plan item when the reviewer changes projects", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn().mockResolvedValue(undefined);
		renderWithClient(
			<ReimbursementFinanceLinkEditor
				request={{
					...request,
					finance_project_id: project.id,
					finance_plan_item_id: planItem.id,
				}}
				projects={[project, otherProject]}
				planItems={[
					planItem,
					{ ...planItem, id: "plan-2027", period_key: "2027" },
				]}
				postings={[posting]}
				disabled={false}
				onSave={onSave}
			/>,
		);

		expect(screen.getByLabelText("Finance plan item")).toHaveTextContent(
			"Prototype materials",
		);
		await user.click(screen.getByLabelText("Finance project"));
		await user.click(screen.getByRole("option", { name: "Makeathon 2027" }));
		expect(screen.getByLabelText("Finance plan item")).toHaveTextContent(
			"No plan item",
		);
		await user.click(screen.getByRole("button", { name: "Save links" }));

		expect(onSave).toHaveBeenCalledWith(otherProject.id, null, null);
	});

	it("submits explicit nulls when all finance links are cleared", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn().mockResolvedValue(undefined);
		renderWithClient(
			<ReimbursementFinanceLinkEditor
				request={{
					...request,
					finance_project_id: project.id,
					finance_plan_item_id: planItem.id,
					bb_posting_external_id: "BB-1001",
				}}
				projects={[project]}
				planItems={[planItem]}
				postings={[posting]}
				disabled={false}
				onSave={onSave}
			/>,
		);

		await user.click(screen.getByLabelText("Finance project"));
		await user.click(screen.getByRole("option", { name: "No project" }));
		await user.click(screen.getByLabelText("BB posting"));
		await user.click(screen.getByText("No posting"));
		await user.click(screen.getByRole("button", { name: "Save links" }));

		expect(onSave).toHaveBeenCalledWith(null, null, null);
	});
});
