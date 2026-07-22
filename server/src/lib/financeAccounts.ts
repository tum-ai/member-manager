import {
	type BuchhaltungsButlerTransaction,
	FINANCE_UNMAPPED_ACCOUNT,
	type FinanceAccountLabel,
	type FinanceAccountLabelRow,
	type FinanceAccountSummary,
} from "@member-manager/shared";
import { getSupabase } from "./supabase.js";

const ACCOUNT_LABELS_TABLE = "finance_account_labels";
const MAX_SAMPLE_TEXTS = 3;

// The classifying ledger account (SKR03 P&L account: 6xxx expense / 8xxx revenue)
// sits on the debit side of every BB posting we see; the credit side is the
// bank clearing account (1200). Aggregating on the debit account is therefore
// what reveals the accounting nature of a posting.
export function accountKey(transaction: BuchhaltungsButlerTransaction): string {
	const account = transaction.debit_postingaccount_number.trim();
	return account === "" ? FINANCE_UNMAPPED_ACCOUNT : account;
}

interface ResolvedAccount {
	label: string | null;
	note: string | null;
}

export function buildAccountLookup(
	labels: FinanceAccountLabel[],
): Map<string, ResolvedAccount> {
	const lookup = new Map<string, ResolvedAccount>();
	for (const entry of labels) {
		lookup.set(entry.account.trim(), {
			label: entry.label,
			note: entry.note,
		});
	}
	return lookup;
}

export async function loadAccountLabels(): Promise<FinanceAccountLabel[]> {
	const { data, error } = await getSupabase()
		.from(ACCOUNT_LABELS_TABLE)
		.select("account, label, note");

	if (error) {
		throw error;
	}

	return (data ?? []).map((row) => ({
		account: String(row.account),
		label: row.label ?? null,
		note: row.note ?? null,
	}));
}

// Upsert a single account label, keyed on the (trimmed) account number.
export async function upsertAccountLabel(input: {
	account: string;
	label: string | null;
	note: string | null;
}): Promise<FinanceAccountLabel> {
	const account = input.account.trim();
	const { data, error } = await getSupabase()
		.from(ACCOUNT_LABELS_TABLE)
		.upsert(
			{
				account,
				label: input.label,
				note: input.note,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "account" },
		)
		.select("account, label, note")
		.single();

	if (error) {
		throw error;
	}

	return {
		account: String(data.account),
		label: data.label ?? null,
		note: data.note ?? null,
	};
}

interface AccountBucket {
	income: number;
	expenses: number;
	net: number;
	count: number;
}

// Roll postings up by their ledger account. The account number is always the
// bucket key; a stored label (if any) is attached for display.
export function aggregateByAccount(
	transactions: BuchhaltungsButlerTransaction[],
	labels: FinanceAccountLabel[],
): FinanceAccountSummary[] {
	const lookup = buildAccountLookup(labels);
	const byAccount = new Map<string, AccountBucket>();

	for (const transaction of transactions) {
		const key = accountKey(transaction);
		const bucket =
			byAccount.get(key) ??
			(() => {
				const created: AccountBucket = {
					income: 0,
					expenses: 0,
					net: 0,
					count: 0,
				};
				byAccount.set(key, created);
				return created;
			})();

		const amount = transaction.transaction_amount;
		if (amount >= 0) {
			bucket.income += amount;
		} else {
			bucket.expenses += Math.abs(amount);
		}
		bucket.net += amount;
		bucket.count += 1;
	}

	return (
		[...byAccount.entries()]
			.map(([account, bucket]) => ({
				account,
				label: lookup.get(account)?.label ?? null,
				income: round(bucket.income),
				expenses: round(bucket.expenses),
				net: round(bucket.net),
				count: bucket.count,
			}))
			// Highest turnover first (expenses, then income as a tie-breaker) so the
			// most material accounts lead.
			.sort((a, b) => b.expenses - a.expenses || b.income - a.income)
	);
}

// Build the rows the account editor shows: every stored label unioned with the
// accounts actually seen in the postings, enriched with usage stats so the LnF
// can tell which accounts still need a human label.
export function buildAccountLabelRows(
	transactions: BuchhaltungsButlerTransaction[],
	labels: FinanceAccountLabel[],
): FinanceAccountLabelRow[] {
	const lookup = buildAccountLookup(labels);
	const stats = new Map<
		string,
		{ count: number; net: number; sampleTexts: string[] }
	>();

	for (const transaction of transactions) {
		const key = accountKey(transaction);
		const entry = stats.get(key) ?? { count: 0, net: 0, sampleTexts: [] };
		entry.count += 1;
		entry.net += transaction.transaction_amount;
		const text = transaction.postingtext.trim();
		if (
			text &&
			!entry.sampleTexts.includes(text) &&
			entry.sampleTexts.length < MAX_SAMPLE_TEXTS
		) {
			entry.sampleTexts.push(text);
		}
		stats.set(key, entry);
	}

	const keys = new Set<string>([...stats.keys(), ...lookup.keys()]);
	return (
		[...keys]
			.map((key) => {
				const resolved = lookup.get(key);
				const stat = stats.get(key);
				return {
					account: key,
					label: resolved?.label ?? null,
					note: resolved?.note ?? null,
					posting_count: stat?.count ?? 0,
					net: round(stat?.net ?? 0),
					sample_texts: stat?.sampleTexts ?? [],
				};
			})
			// Unlabelled rows with the most postings first — those need attention.
			.sort((a, b) => {
				const aSet = a.label ? 1 : 0;
				const bSet = b.label ? 1 : 0;
				if (aSet !== bSet) {
					return aSet - bSet;
				}
				return b.posting_count - a.posting_count;
			})
	);
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
