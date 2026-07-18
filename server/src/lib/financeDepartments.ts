import {
	type BuchhaltungsButlerTransaction,
	FINANCE_UNMAPPED_DEPARTMENT,
	type FinanceAnalyticsResponse,
	type FinanceBereich,
	type FinanceDepartmentMapping,
	type FinanceDepartmentMappingRow,
} from "@member-manager/shared";
import { getSupabase } from "./supabase.js";

const MAPPINGS_TABLE = "finance_department_mappings";
const MAX_SAMPLE_TEXTS = 3;

// Cost locations arrive zero-padded but inconsistently ("82" vs "082"), so we
// key everything on a normalized form: leading zeros stripped, empty -> "0".
export function normalizeCostLocation(value: string): string {
	const trimmed = value.trim().replace(/^0+/, "");
	return trimmed === "" ? "0" : trimmed;
}

interface ResolvedMapping {
	department: string | null;
	bereich: FinanceBereich | null;
	note: string | null;
}

export function buildMappingLookup(
	mappings: FinanceDepartmentMapping[],
): Map<string, ResolvedMapping> {
	const lookup = new Map<string, ResolvedMapping>();
	for (const mapping of mappings) {
		lookup.set(normalizeCostLocation(mapping.cost_location), {
			department: mapping.department,
			bereich: mapping.bereich,
			note: mapping.note,
		});
	}
	return lookup;
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
	"source" | "generated_at" | "by_category" | "by_account"
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

	for (const transaction of transactions) {
		const amount = transaction.transaction_amount;
		const resolved = lookup.get(
			normalizeCostLocation(transaction.cost_location),
		);
		const department = resolved?.department ?? FINANCE_UNMAPPED_DEPARTMENT;
		const bereich = resolved?.department ? (resolved.bereich ?? null) : null;
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
