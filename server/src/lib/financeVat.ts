import type {
	BuchhaltungsButlerTransaction,
	FinanceVatRateSummary,
} from "@member-manager/shared";

// BuchhaltungsButler reports `vat` as a percentage rate (e.g. 19), not an
// amount, and `transaction_amount` is gross (tax included). Derive the VAT
// contained in a gross figure: gross * rate / (100 + rate). Mirrors the client
// `computeVatAmount` so both sides agree.
export function embeddedVat(grossAmount: number, rate: number): number {
	if (!rate || rate <= 0) {
		return 0;
	}
	const gross = Math.abs(grossAmount);
	return round((gross * rate) / (100 + rate));
}

// Total VAT contained in the expense postings (amount < 0). Net expenses excl.
// VAT are `expenses - expenseVatTotal`.
export function expenseVatTotal(
	transactions: BuchhaltungsButlerTransaction[],
): number {
	let total = 0;
	for (const transaction of transactions) {
		if (transaction.transaction_amount < 0) {
			total += embeddedVat(transaction.transaction_amount, transaction.vat);
		}
	}
	return round(total);
}

interface VatBucket {
	expenses: number;
	vat: number;
	count: number;
}

// Group the expense postings by their VAT rate so each row is an unambiguous
// gross / VAT / net triple. Income postings are out of scope here — this view
// exists to net-of-VAT the spend side for budgeting.
export function aggregateByVatRate(
	transactions: BuchhaltungsButlerTransaction[],
): FinanceVatRateSummary[] {
	const byRate = new Map<number, VatBucket>();

	for (const transaction of transactions) {
		if (transaction.transaction_amount >= 0) {
			continue;
		}
		const rate = transaction.vat > 0 ? transaction.vat : 0;
		const bucket = byRate.get(rate) ?? { expenses: 0, vat: 0, count: 0 };
		bucket.expenses += Math.abs(transaction.transaction_amount);
		bucket.vat += embeddedVat(transaction.transaction_amount, rate);
		bucket.count += 1;
		byRate.set(rate, bucket);
	}

	return (
		[...byRate.entries()]
			.map(([rate, bucket]) => ({
				rate,
				expenses: round(bucket.expenses),
				vat: round(bucket.vat),
				count: bucket.count,
			}))
			// Highest rate first (19 % before 7 % before 0 %).
			.sort((a, b) => b.rate - a.rate)
	);
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
