import type {
	BuchhaltungsButlerTransaction,
	FinanceBereich,
	FinanceDirectionFilter,
	FinanceFilters,
	FinanceSummary,
} from "./financeTypes";

const BEREICH_LABELS: Record<FinanceBereich, string> = {
	ideell: "Ideeller Bereich",
	wirtschaftlich: "Wirtschaftlicher Geschäftsbetrieb",
	zweckbetrieb: "Zweckbetrieb",
};

export function formatBereichLabel(bereich: FinanceBereich | null): string {
	return bereich ? BEREICH_LABELS[bereich] : "Ohne Bereich";
}

export const FINANCE_BEREICH_OPTIONS: ReadonlyArray<{
	value: FinanceBereich;
	label: string;
}> = [
	{ value: "ideell", label: BEREICH_LABELS.ideell },
	{ value: "wirtschaftlich", label: BEREICH_LABELS.wirtschaftlich },
	{ value: "zweckbetrieb", label: BEREICH_LABELS.zweckbetrieb },
];

// Compact month label ("Feb 2026") for chart axes from a "YYYY-MM" key.
export function formatFinanceMonth(month: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(month);
	if (!match) {
		return month;
	}
	const [, year, monthPart] = match;
	const index = Number(monthPart) - 1;
	if (index < 0 || index >= SHORT_MONTHS.length) {
		return month;
	}
	return `${SHORT_MONTHS[index]} ${year}`;
}

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

// Magnitude-adaptive short amount for chart axes/labels: 940 → "940 €",
// 35 500 → "36k €", 1 240 000 → "1,2 Mio €". Keeps ticks readable and lets them
// scale automatically with the data range.
export function formatFinanceAmountCompact(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1_000_000) {
		const millions = value / 1_000_000;
		return `${millions.toLocaleString("de-DE", {
			maximumFractionDigits: 1,
		})} Mio €`;
	}
	if (abs >= 1_000) {
		return `${Math.round(value / 1_000).toLocaleString("de-DE")}k €`;
	}
	return `${Math.round(value).toLocaleString("de-DE")} €`;
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

// BuchhaltungsButler reports `vat` as a percentage rate (e.g. 19), not an
// amount. Derive the tax portion contained in the (gross) posting so the total
// is a meaningful currency figure instead of a sum of rates.
export function computeVatAmount(
	transaction: BuchhaltungsButlerTransaction,
): number {
	const rate = transaction.vat;
	if (!rate || rate <= 0) {
		return 0;
	}
	const gross = Math.abs(transaction.transaction_amount);
	return Math.round(((gross * rate) / (100 + rate)) * 100) / 100;
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
				vat: summary.vat + computeVatAmount(transaction),
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
