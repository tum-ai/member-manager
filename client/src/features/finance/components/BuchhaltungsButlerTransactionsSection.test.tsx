import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BuchhaltungsButlerTransactionsSection } from "./BuchhaltungsButlerTransactionsSection";

const transaction = {
	external_id: "BB-1",
	date: "2026-02-14",
	postingtext: "Sponsoring JetBrains",
	amount: 7500,
	currency: "EUR",
	vat: 0,
	credit_type: "credit",
	debit_postingaccount_number: "8450",
	credit_postingaccount_number: "1200",
	cost_location: "120",
	cost_location_two: "0",
	transaction_amount: 7500,
	transaction_purpose: "JetBrains partnership tranche 1",
};

function renderSection(
	overrides: Partial<
		React.ComponentProps<typeof BuchhaltungsButlerTransactionsSection>
	> = {},
) {
	const props: React.ComponentProps<
		typeof BuchhaltungsButlerTransactionsSection
	> = {
		filters: {
			dateFrom: "2026-01-01",
			dateTo: "2026-07-08",
			searchTerm: "",
			direction: "all",
			sortOrder: "date-desc",
		},
		transactions: [transaction],
		generatedAt: "2026-07-08T12:00:00.000Z",
		isLoading: false,
		isFetching: false,
		error: null,
		onDateFromChange: vi.fn(),
		onDateToChange: vi.fn(),
		onSearchTermChange: vi.fn(),
		onDirectionChange: vi.fn(),
		onSortOrderChange: vi.fn(),
		onRefresh: vi.fn(),
		onExport: vi.fn(),
		...overrides,
	};
	render(<BuchhaltungsButlerTransactionsSection {...props} />);
	return props;
}

describe("BuchhaltungsButlerTransactionsSection", () => {
	it("renders transaction rows without exposing the data source", () => {
		renderSection();

		expect(screen.getByText("BuchhaltungsButler Postings")).toBeInTheDocument();
		expect(screen.queryByText("Mock data")).not.toBeInTheDocument();
		expect(screen.queryByText("Real API")).not.toBeInTheDocument();
		expect(screen.getByText("Sponsoring JetBrains")).toBeInTheDocument();
		expect(
			screen.getByText("JetBrains partnership tranche 1"),
		).toBeInTheDocument();
	});

	it("forwards filter and action changes", async () => {
		const user = userEvent.setup();
		const props = renderSection();

		await user.clear(screen.getByLabelText("Search"));
		await user.type(screen.getByLabelText("Search"), "s");
		expect(props.onSearchTermChange).toHaveBeenCalledWith("s");

		await user.click(screen.getByLabelText("Transaction Type"));
		await user.click(
			await within(await screen.findByRole("listbox")).findByRole("option", {
				name: "Expenses",
			}),
		);
		expect(props.onDirectionChange).toHaveBeenCalledWith("expenses");

		await user.click(screen.getByLabelText("Sort order"));
		await user.click(
			await within(await screen.findByRole("listbox")).findByRole("option", {
				name: "Oldest first",
			}),
		);
		expect(props.onSortOrderChange).toHaveBeenCalledWith("date-asc");

		await user.click(screen.getByRole("button", { name: /refresh/i }));
		await user.click(screen.getByRole("button", { name: /export/i }));
		expect(props.onRefresh).toHaveBeenCalled();
		expect(props.onExport).toHaveBeenCalled();
	});

	it("shows empty and error states", () => {
		renderSection({ transactions: [] });
		expect(
			screen.getByText(/no transactions match the current filters/i),
		).toBeInTheDocument();

		renderSection({ error: new Error("Could not load postings") });
		expect(screen.getByText("Could not load postings")).toBeInTheDocument();
	});
});
