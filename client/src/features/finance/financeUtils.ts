import type {
	BuchhaltungsButlerTransaction,
	FinanceDirectionFilter,
	FinanceFilters,
	FinanceSummary,
} from "./financeTypes";

const SHORT_MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;
const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatLocalDateInput(reference: Date): string {
	const year = reference.getFullYear();
	const month = String(reference.getMonth() + 1).padStart(2, "0");
	const day = String(reference.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function getDefaultFinanceDateRange(reference = new Date()): {
	dateFrom: string;
	dateTo: string;
} {
	const year = reference.getFullYear();
	return {
		dateFrom: `${year}-01-01`,
		dateTo: formatLocalDateInput(reference),
	};
}

export function formatFinanceAmount(value: number, currency = "EUR"): string {
	return new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency,
	}).format(value);
}

export function formatFinanceDate(value: string): string {
	const civilDate = CIVIL_DATE_PATTERN.exec(value);
	if (civilDate) {
		const [, year, month, day] = civilDate;
		const monthIndex = Number(month) - 1;
		if (monthIndex >= 0 && monthIndex < SHORT_MONTHS.length) {
			return `${day} ${SHORT_MONTHS[monthIndex]} ${year}`;
		}
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
}

function matchesDirection(
	transaction: BuchhaltungsButlerTransaction,
	direction: FinanceDirectionFilter,
): boolean {
	if (direction === "income") {
		return transaction.transaction_amount >= 0;
	}
	if (direction === "expenses") {
		return transaction.transaction_amount < 0;
	}
	return true;
}

function matchesSearch(
	transaction: BuchhaltungsButlerTransaction,
	searchTerm: string,
): boolean {
	const search = searchTerm.trim().toLowerCase();
	if (!search) {
		return true;
	}

	return [
		transaction.external_id,
		transaction.date,
		transaction.postingtext,
		transaction.transaction_purpose,
		transaction.debit_postingaccount_number,
		transaction.credit_postingaccount_number,
		transaction.cost_location,
		transaction.cost_location_two,
		String(transaction.transaction_amount),
	].some((value) => value.toLowerCase().includes(search));
}

export function filterFinanceTransactions(
	transactions: BuchhaltungsButlerTransaction[],
	filters: FinanceFilters,
): BuchhaltungsButlerTransaction[] {
	return transactions.filter(
		(transaction) =>
			matchesDirection(transaction, filters.direction) &&
			matchesSearch(transaction, filters.searchTerm),
	);
}

export function summarizeFinanceTransactions(
	transactions: BuchhaltungsButlerTransaction[],
): FinanceSummary {
	return transactions.reduce<FinanceSummary>(
		(summary, transaction) => {
			const amount = transaction.transaction_amount;
			return {
				count: summary.count + 1,
				income: summary.income + (amount >= 0 ? amount : 0),
				expenses: summary.expenses + (amount < 0 ? Math.abs(amount) : 0),
				net: summary.net + amount,
				vat: summary.vat + transaction.vat,
			};
		},
		{ count: 0, income: 0, expenses: 0, net: 0, vat: 0 },
	);
}

export function buildFinanceExportRows(
	transactions: BuchhaltungsButlerTransaction[],
): Array<Record<string, string | number>> {
	return transactions.map((transaction) => ({
		"External ID": transaction.external_id,
		Date: transaction.date,
		"Posting Text": transaction.postingtext,
		Amount: transaction.amount,
		Currency: transaction.currency,
		VAT: transaction.vat,
		"Credit Type": transaction.credit_type,
		"Debit Account": transaction.debit_postingaccount_number,
		"Credit Account": transaction.credit_postingaccount_number,
		"Cost Location": transaction.cost_location,
		"Cost Location 2": transaction.cost_location_two,
		"Transaction Amount": transaction.transaction_amount,
		"Transaction Purpose": transaction.transaction_purpose,
	}));
}
