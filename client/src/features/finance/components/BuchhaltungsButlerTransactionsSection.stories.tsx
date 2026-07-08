import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDirectionFilter,
	FinanceFilters,
} from "@/features/finance/financeTypes";
import { BuchhaltungsButlerTransactionsSection } from "./BuchhaltungsButlerTransactionsSection";

const transactions: BuchhaltungsButlerTransaction[] = [
	{
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
	},
	{
		external_id: "BB-2",
		date: "2026-02-01",
		postingtext: "Slack subscription",
		amount: -266,
		currency: "EUR",
		vat: 19,
		credit_type: "debit",
		debit_postingaccount_number: "6840",
		credit_postingaccount_number: "1200",
		cost_location: "130",
		cost_location_two: "5",
		transaction_amount: -266,
		transaction_purpose: "Slack monthly plan",
	},
];

const meta = {
	title: "Features/Finance/BuchhaltungsButlerTransactionsSection",
	component: BuchhaltungsButlerTransactionsSection,
	parameters: {
		layout: "padded",
	},
} satisfies Meta<typeof BuchhaltungsButlerTransactionsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

function InteractiveSection() {
	const [filters, setFilters] = useState<FinanceFilters>({
		dateFrom: "2026-01-01",
		dateTo: "2026-07-08",
		searchTerm: "",
		direction: "all",
	});
	const visibleTransactions = transactions.filter((transaction) => {
		const matchesSearch = transaction.postingtext
			.toLowerCase()
			.includes(filters.searchTerm.toLowerCase());
		const matchesDirection =
			filters.direction === "all" ||
			(filters.direction === "income" && transaction.transaction_amount >= 0) ||
			(filters.direction === "expenses" && transaction.transaction_amount < 0);
		return matchesSearch && matchesDirection;
	});

	return (
		<BuchhaltungsButlerTransactionsSection
			filters={filters}
			transactions={visibleTransactions}
			source="mock"
			generatedAt="2026-07-08T12:00:00.000Z"
			isLoading={false}
			isFetching={false}
			error={null}
			onDateFromChange={(dateFrom) =>
				setFilters((current) => ({ ...current, dateFrom }))
			}
			onDateToChange={(dateTo) =>
				setFilters((current) => ({ ...current, dateTo }))
			}
			onSearchTermChange={(searchTerm) =>
				setFilters((current) => ({ ...current, searchTerm }))
			}
			onDirectionChange={(direction: FinanceDirectionFilter) =>
				setFilters((current) => ({ ...current, direction }))
			}
			onRefresh={() => undefined}
			onExport={() => undefined}
		/>
	);
}

export const Default: Story = {
	args: {
		filters: {
			dateFrom: "2026-01-01",
			dateTo: "2026-07-08",
			searchTerm: "",
			direction: "all",
		},
		transactions,
		source: "mock",
		generatedAt: "2026-07-08T12:00:00.000Z",
		isLoading: false,
		isFetching: false,
		error: null,
		onDateFromChange: () => undefined,
		onDateToChange: () => undefined,
		onSearchTermChange: () => undefined,
		onDirectionChange: () => undefined,
		onRefresh: () => undefined,
		onExport: () => undefined,
	},
	render: () => <InteractiveSection />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Sponsoring JetBrains")).toBeInTheDocument();

		await userEvent.type(canvas.getByLabelText("Search"), "slack");
		await expect(
			canvas.queryByText("Sponsoring JetBrains"),
		).not.toBeInTheDocument();
		await expect(canvas.getByText("Slack subscription")).toBeInTheDocument();
	},
};
