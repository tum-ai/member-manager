import {
	type BuchhaltungsButlerTransaction,
	FINANCE_UNMAPPED_DEPARTMENT,
	type FinanceAnalyticsResponse,
	type FinanceBereich,
	type FinanceDepartmentMapping,
	type FinanceDepartmentMappingRow,
} from "@member-manager/shared";
import { embeddedVat } from "./financeVat.js";
import { getSupabase } from "./supabase.js";

const MAPPINGS_TABLE = "finance_department_mappings";
const ALLOCATIONS_TABLE = "finance_posting_allocations";
const ALLOCATION_QUERY_BATCH_SIZE = 500;
const MAX_SAMPLE_TEXTS = 3;

// Cost locations arrive zero-padded but inconsistently ("82" vs "082"), so we
// key everything on a normalized form: leading zeros stripped, empty -> "0".
export function normalizeCostLocation(value: string): string {
	const trimmed = value.trim().replace(/^0+/, "");
	return trimmed === "" ? "0" : trimmed;
}

export interface ResolvedDepartmentMapping {
	department: string | null;
	bereich: FinanceBereich | null;
	note: string | null;
}

export function buildMappingLookup(
	mappings: FinanceDepartmentMapping[],
): Map<string, ResolvedDepartmentMapping> {
	const lookup = new Map<string, ResolvedDepartmentMapping>();
	for (const mapping of mappings) {
		lookup.set(normalizeCostLocation(mapping.cost_location), {
			department: mapping.department,
			bereich: mapping.bereich,
			note: mapping.note,
		});
	}
	return lookup;
}

interface EffectiveDepartmentMetadata {
	department: string | null;
	bereich: FinanceBereich | null;
}

const EFFECTIVE_DEPARTMENT = Symbol("effectiveFinanceDepartment");

type EffectiveDepartmentTransaction = BuchhaltungsButlerTransaction & {
	[EFFECTIVE_DEPARTMENT]?: EffectiveDepartmentMetadata;
};

export interface SavedPostingAllocation {
	posting_external_id: string;
	department: string | null;
	project_id?: string | null;
	tax_area: FinanceBereich | null;
	allocated_amount: number;
	allocated_percentage?: number;
}

export interface EffectivePostingSplit {
	posting: BuchhaltungsButlerTransaction;
	department: string | null;
	projectId: string | null;
	taxArea: FinanceBereich | null;
	amount: number;
}

export function resolveTransactionDepartment(
	transaction: BuchhaltungsButlerTransaction,
	lookup: Map<string, ResolvedDepartmentMapping>,
): EffectiveDepartmentMetadata {
	const effective = (transaction as EffectiveDepartmentTransaction)[
		EFFECTIVE_DEPARTMENT
	];
	if (effective) {
		return effective;
	}

	const costLocation = normalizeCostLocation(transaction.cost_location);
	if (lookup.has(costLocation)) {
		const stored = lookup.get(costLocation);
		return {
			department: stored?.department ?? null,
			bereich: stored?.department ? (stored.bereich ?? null) : null,
		};
	}

	return {
		department: null,
		bereich: null,
	};
}

export function inferAccountTaxArea(account: string): FinanceBereich | null {
	const suffix = account.trim().slice(-2);
	if (suffix === "10") return "ideell";
	if (suffix === "40") return "wirtschaftlich";
	if (suffix === "50") return "gemischt";
	return null;
}

export function resolveTransactionTaxArea(
	transaction: BuchhaltungsButlerTransaction,
	lookup: Map<string, ResolvedDepartmentMapping>,
): FinanceBereich | null {
	const effective = (transaction as EffectiveDepartmentTransaction)[
		EFFECTIVE_DEPARTMENT
	];
	if (effective?.bereich) {
		return effective.bereich;
	}
	return (
		inferAccountTaxArea(transaction.debit_postingaccount_number) ??
		lookup.get(normalizeCostLocation(transaction.cost_location))?.bereich ??
		null
	);
}

function attachEffectiveDepartment(
	transaction: BuchhaltungsButlerTransaction,
	metadata: EffectiveDepartmentMetadata,
): BuchhaltungsButlerTransaction {
	Object.defineProperty(transaction, EFFECTIVE_DEPARTMENT, {
		value: metadata,
		enumerable: false,
	});
	return transaction;
}

export function applySavedPostingAllocations(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
	allocations: SavedPostingAllocation[],
): BuchhaltungsButlerTransaction[] {
	return buildEffectivePostingCandidates(
		transactions,
		mappings,
		allocations,
	).map(effectiveSplitToTransaction);
}

function buildEffectivePostingCandidates(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
	allocations: SavedPostingAllocation[],
): EffectivePostingSplit[] {
	const lookup = buildMappingLookup(mappings);
	const allocationsByPosting = new Map<string, SavedPostingAllocation[]>();

	for (const allocation of allocations) {
		const rows = allocationsByPosting.get(allocation.posting_external_id) ?? [];
		rows.push(allocation);
		allocationsByPosting.set(allocation.posting_external_id, rows);
	}

	return transactions.flatMap((transaction) => {
		const saved = allocationsByPosting.get(transaction.external_id);
		if (!saved || saved.length === 0) {
			return [
				{
					posting: transaction,
					department: resolveTransactionDepartment(transaction, lookup)
						.department,
					projectId: null,
					taxArea: resolveTransactionTaxArea(transaction, lookup),
					amount: transaction.transaction_amount,
				},
			];
		}

		const defaultDepartment = resolveTransactionDepartment(
			transaction,
			lookup,
		).department;
		const defaultTaxArea = resolveTransactionTaxArea(transaction, lookup);
		return apportionPostingAmount(transaction.transaction_amount, saved).map(
			({ allocation, amount }) => ({
				posting: transaction,
				department: allocation.department ?? defaultDepartment,
				projectId: allocation.project_id ?? null,
				taxArea: allocation.tax_area ?? defaultTaxArea,
				amount,
			}),
		);
	});
}

interface PostingAllocationApportionmentInput {
	department: string | null;
	project_id?: string | null;
	tax_area?: string | null;
	allocated_percentage?: number;
}

function compareCodePointOrder(left: string, right: string): number {
	const leftCodePoints = Array.from(left, (value) => value.codePointAt(0) ?? 0);
	const rightCodePoints = Array.from(
		right,
		(value) => value.codePointAt(0) ?? 0,
	);
	const length = Math.min(leftCodePoints.length, rightCodePoints.length);

	for (let index = 0; index < length; index += 1) {
		const difference = leftCodePoints[index] - rightCodePoints[index];
		if (difference !== 0) return difference;
	}
	return leftCodePoints.length - rightCodePoints.length;
}

function compareAllocationOrder(
	left: PostingAllocationApportionmentInput,
	right: PostingAllocationApportionmentInput,
): number {
	for (const [leftValue, rightValue] of [
		[left.department, right.department],
		[left.project_id, right.project_id],
		[left.tax_area, right.tax_area],
	] as const) {
		const comparison = compareCodePointOrder(leftValue ?? "", rightValue ?? "");
		if (comparison !== 0) return comparison;
	}
	return 0;
}

export function apportionPostingAmount<
	TAllocation extends PostingAllocationApportionmentInput,
>(
	transactionAmount: number,
	allocations: TAllocation[],
): Array<{ allocation: TAllocation; amount: number }> {
	const ordered = [...allocations].sort(compareAllocationOrder);
	const postingCents = Math.round(transactionAmount * 100);
	let allocatedCents = 0;

	return ordered.map((allocation, index) => {
		const isLast = index === ordered.length - 1;
		const percentage =
			allocation.allocated_percentage ?? (ordered.length === 1 ? 100 : null);
		if (
			percentage === null ||
			!Number.isFinite(percentage) ||
			percentage <= 0
		) {
			throw new Error(
				"Persisted split allocations require a positive allocated percentage",
			);
		}
		const amountCents = isLast
			? postingCents - allocatedCents
			: Math.round((postingCents * percentage) / 100);
		allocatedCents += amountCents;
		return { allocation, amount: amountCents / 100 };
	});
}

function mixedWirtschaftlichRatio(splits: EffectivePostingSplit[]): number {
	let ideellExpenses = 0;
	let wirtschaftlichExpenses = 0;
	for (const split of splits) {
		if (split.amount >= 0) continue;
		const expense = Math.abs(split.amount);
		if (split.taxArea === "ideell") ideellExpenses += expense;
		if (split.taxArea === "wirtschaftlich") wirtschaftlichExpenses += expense;
	}
	const total = ideellExpenses + wirtschaftlichExpenses;
	return total === 0 ? 0.5 : wirtschaftlichExpenses / total;
}

export function buildEffectivePostingSplits(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
	allocations: SavedPostingAllocation[],
): EffectivePostingSplit[] {
	const candidates = buildEffectivePostingCandidates(
		transactions,
		mappings,
		allocations,
	);
	const ratio = mixedWirtschaftlichRatio(candidates);
	return candidates.flatMap((candidate) => {
		if (candidate.taxArea !== "gemischt") {
			return [candidate];
		}
		const wirtschaftlichAmount = round(candidate.amount * ratio);
		return [
			{
				...candidate,
				taxArea: "ideell" as const,
				amount: round(candidate.amount - wirtschaftlichAmount),
			},
			{
				...candidate,
				taxArea: "wirtschaftlich" as const,
				amount: wirtschaftlichAmount,
			},
		];
	});
}

function effectiveSplitToTransaction(
	split: EffectivePostingSplit,
): BuchhaltungsButlerTransaction {
	return attachEffectiveDepartment(
		{
			...split.posting,
			amount: split.amount,
			transaction_amount: split.amount,
		},
		{
			department: split.department,
			bereich: split.taxArea,
		},
	);
}

export function buildEffectiveDepartmentTransactions(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
	allocations: SavedPostingAllocation[],
): BuchhaltungsButlerTransaction[] {
	return buildEffectivePostingSplits(transactions, mappings, allocations).map(
		effectiveSplitToTransaction,
	);
}

export function splitMixedTaxAreaTransactions(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
): BuchhaltungsButlerTransaction[] {
	return buildEffectiveDepartmentTransactions(transactions, mappings, []);
}

export async function loadEffectiveDepartmentTransactions(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
): Promise<BuchhaltungsButlerTransaction[]> {
	const postingExternalIds = [
		...new Set(transactions.map((transaction) => transaction.external_id)),
	];
	if (postingExternalIds.length === 0) {
		return [];
	}

	const rows: Array<Record<string, unknown>> = [];
	for (
		let index = 0;
		index < postingExternalIds.length;
		index += ALLOCATION_QUERY_BATCH_SIZE
	) {
		const batch = postingExternalIds.slice(
			index,
			index + ALLOCATION_QUERY_BATCH_SIZE,
		);
		const { data, error } = await getSupabase()
			.from(ALLOCATIONS_TABLE)
			.select(
				"posting_external_id, department, tax_area, allocated_amount, allocated_percentage",
			)
			.in("posting_external_id", batch);

		if (error) {
			throw error;
		}
		rows.push(...(data ?? []));
	}

	const allocations = rows.map((row) => ({
		posting_external_id: String(row.posting_external_id),
		department: row.department ? String(row.department) : null,
		tax_area: (row.tax_area ?? null) as FinanceBereich | null,
		allocated_amount: Number(row.allocated_amount),
		allocated_percentage: Number(row.allocated_percentage),
	}));
	return buildEffectiveDepartmentTransactions(
		transactions,
		mappings,
		allocations,
	);
}

export async function loadDepartmentMappings(): Promise<
	FinanceDepartmentMapping[]
> {
	const { data, error } = await getSupabase()
		.from(MAPPINGS_TABLE)
		.select("cost_location, department, bereich, note");

	if (error) {
		throw error;
	}

	return (data ?? []).map((row) => ({
		cost_location: String(row.cost_location),
		department: row.department ?? null,
		bereich: (row.bereich ?? null) as FinanceBereich | null,
		note: row.note ?? null,
	}));
}

// Upsert a single mapping. Keyed on the normalized cost location so the same
// Kostenstelle can never end up split across padded/unpadded rows.
export async function upsertDepartmentMapping(input: {
	costLocation: string;
	department: string | null;
	bereich: FinanceBereich | null;
	note: string | null;
}): Promise<FinanceDepartmentMapping> {
	const costLocation = normalizeCostLocation(input.costLocation);
	const { data, error } = await getSupabase()
		.from(MAPPINGS_TABLE)
		.upsert(
			{
				cost_location: costLocation,
				department: input.department,
				bereich: input.bereich,
				note: input.note,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "cost_location" },
		)
		.select("cost_location, department, bereich, note")
		.single();

	if (error) {
		throw error;
	}

	return {
		cost_location: String(data.cost_location),
		department: data.department ?? null,
		bereich: (data.bereich ?? null) as FinanceBereich | null,
		note: data.note ?? null,
	};
}

function monthKey(isoDate: string): string {
	return isoDate.slice(0, 7);
}

interface Bucket {
	income: number;
	expenses: number;
	net: number;
	count: number;
}

function emptyBucket(): Bucket {
	return { income: 0, expenses: 0, net: 0, count: 0 };
}

function applyAmount(bucket: Bucket, amount: number): void {
	if (amount >= 0) {
		bucket.income += amount;
	} else {
		bucket.expenses += Math.abs(amount);
	}
	bucket.net += amount;
	bucket.count += 1;
}

// Aggregate postings into the per-department / per-month / per-Bereich rollups
// the LnF analytics page renders. Postings whose (normalized) cost location has
// no assignment land in the FINANCE_UNMAPPED_DEPARTMENT bucket so nothing is
// silently dropped.
export function aggregateByDepartment(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
): Omit<
	FinanceAnalyticsResponse,
	"source" | "generated_at" | "by_category" | "by_account" | "by_vat_rate"
> {
	const lookup = buildMappingLookup(mappings);

	const byDepartment = new Map<
		string,
		Bucket & {
			bereiche: Set<FinanceBereich | null>;
			unmapped: boolean;
		}
	>();
	const byMonth = new Map<string, Bucket>();
	const byBereich = new Map<
		string,
		Bucket & { bereich: FinanceBereich | null }
	>();
	const totals = emptyBucket();
	let unmappedCount = 0;
	let expenseVat = 0;

	for (const transaction of splitMixedTaxAreaTransactions(
		transactions,
		mappings,
	)) {
		const amount = transaction.transaction_amount;
		if (amount < 0) {
			expenseVat += embeddedVat(amount, transaction.vat);
		}
		const resolved = resolveTransactionDepartment(transaction, lookup);
		const department = resolved?.department ?? FINANCE_UNMAPPED_DEPARTMENT;
		const bereich = resolved?.department
			? resolveTransactionTaxArea(transaction, lookup)
			: null;
		const isUnmapped = !resolved?.department;

		let deptBucket = byDepartment.get(department);
		if (!deptBucket) {
			deptBucket = {
				...emptyBucket(),
				bereiche: new Set<FinanceBereich | null>(),
				unmapped: isUnmapped,
			};
			byDepartment.set(department, deptBucket);
		}
		deptBucket.bereiche.add(bereich);
		applyAmount(deptBucket, amount);

		const month = monthKey(transaction.date);
		const monthBucket = byMonth.get(month) ?? emptyBucket();
		applyAmount(monthBucket, amount);
		byMonth.set(month, monthBucket);

		const bereichKey = bereich ?? "__none__";
		const bereichBucket = byBereich.get(bereichKey) ?? {
			...emptyBucket(),
			bereich,
		};
		applyAmount(bereichBucket, amount);
		byBereich.set(bereichKey, bereichBucket);

		applyAmount(totals, amount);
		if (isUnmapped) {
			unmappedCount += 1;
		}
	}

	return {
		by_department: [...byDepartment.entries()]
			.map(([department, bucket]) => ({
				department,
				bereich:
					bucket.bereiche.size === 1
						? (bucket.bereiche.values().next().value ?? null)
						: null,
				income: round(bucket.income),
				expenses: round(bucket.expenses),
				net: round(bucket.net),
				count: bucket.count,
				unmapped: bucket.unmapped,
			}))
			// Largest expenses first; the unmapped bucket always sinks to the end.
			.sort((a, b) => {
				if (a.unmapped !== b.unmapped) {
					return a.unmapped ? 1 : -1;
				}
				return b.expenses - a.expenses;
			}),
		by_month: [...byMonth.entries()]
			.map(([month, bucket]) => ({
				month,
				income: round(bucket.income),
				expenses: round(bucket.expenses),
				net: round(bucket.net),
			}))
			.sort((a, b) => a.month.localeCompare(b.month)),
		by_bereich: [...byBereich.values()]
			.map((bucket) => ({
				bereich: bucket.bereich,
				income: round(bucket.income),
				expenses: round(bucket.expenses),
				net: round(bucket.net),
				count: bucket.count,
			}))
			.sort((a, b) => b.expenses - a.expenses),
		totals: {
			income: round(totals.income),
			expenses: round(totals.expenses),
			net: round(totals.net),
			vat: round(expenseVat),
			count: totals.count,
			unmapped_count: unmappedCount,
		},
	};
}

// Build the rows the mapping editor shows: every stored mapping unioned with
// the cost locations actually seen in the postings, enriched with usage stats
// so the LnF can tell which Kostenstellen still need assigning.
export function buildMappingRows(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceDepartmentMapping[],
): FinanceDepartmentMappingRow[] {
	const lookup = buildMappingLookup(mappings);
	const stats = new Map<
		string,
		{ count: number; net: number; sampleTexts: string[] }
	>();

	for (const transaction of transactions) {
		const key = normalizeCostLocation(transaction.cost_location);
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
					cost_location: key,
					department: resolved?.department ?? null,
					bereich: resolved?.bereich ?? null,
					note: resolved?.note ?? null,
					posting_count: stat?.count ?? 0,
					net: round(stat?.net ?? 0),
					sample_texts: stat?.sampleTexts ?? [],
				};
			})
			// Unassigned rows with the most postings first — those need attention.
			.sort((a, b) => {
				const aUnset = a.department ? 1 : 0;
				const bUnset = b.department ? 1 : 0;
				if (aUnset !== bUnset) {
					return aUnset - bUnset;
				}
				return b.posting_count - a.posting_count;
			})
	);
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
