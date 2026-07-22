import {
	type BuchhaltungsButlerTransaction,
	FINANCE_UNMAPPED_CATEGORY,
	type FinanceCategoryMapping,
	type FinanceCategoryMappingRow,
	type FinanceCategorySummary,
} from "@member-manager/shared";
import { normalizeCostLocation } from "./financeDepartments.js";
import { getSupabase } from "./supabase.js";

const CATEGORY_MAPPINGS_TABLE = "finance_category_mappings";
const MAX_SAMPLE_TEXTS = 3;

interface ResolvedCategory {
	label: string | null;
	note: string | null;
}

// The secondary cost location is keyed the same way as the
// primary one: leading zeros stripped, empty/all-zero collapse to "0".
export function buildCategoryLookup(
	mappings: FinanceCategoryMapping[],
): Map<string, ResolvedCategory> {
	const lookup = new Map<string, ResolvedCategory>();
	for (const mapping of mappings) {
		lookup.set(normalizeCostLocation(mapping.cost_location_two), {
			label: mapping.label,
			note: mapping.note,
		});
	}
	return lookup;
}

export async function loadCategoryMappings(): Promise<
	FinanceCategoryMapping[]
> {
	const { data, error } = await getSupabase()
		.from(CATEGORY_MAPPINGS_TABLE)
		.select("cost_location_two, label, note");

	if (error) {
		throw error;
	}

	return (data ?? []).map((row) => ({
		cost_location_two: String(row.cost_location_two),
		label: row.label ?? null,
		note: row.note ?? null,
	}));
}

// Upsert a single category label. Keyed on the normalized second cost location
// so a cost location can never end up split across padded/unpadded rows.
export async function upsertCategoryMapping(input: {
	costLocationTwo: string;
	label: string | null;
	note: string | null;
}): Promise<FinanceCategoryMapping> {
	const costLocationTwo = normalizeCostLocation(input.costLocationTwo);
	const { data, error } = await getSupabase()
		.from(CATEGORY_MAPPINGS_TABLE)
		.upsert(
			{
				cost_location_two: costLocationTwo,
				label: input.label,
				note: input.note,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "cost_location_two" },
		)
		.select("cost_location_two, label, note")
		.single();

	if (error) {
		throw error;
	}

	return {
		cost_location_two: String(data.cost_location_two),
		label: data.label ?? null,
		note: data.note ?? null,
	};
}

interface CategoryBucket {
	income: number;
	expenses: number;
	net: number;
	count: number;
	unmapped: boolean;
}

// Roll postings up by their labelled second cost location. Postings whose
// Secondary cost locations with no label (including the "0"/none default) land in the
// FINANCE_UNMAPPED_CATEGORY bucket so nothing is silently dropped.
export function aggregateByCategory(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceCategoryMapping[],
): FinanceCategorySummary[] {
	const lookup = buildCategoryLookup(mappings);
	const byCategory = new Map<string, CategoryBucket>();

	for (const transaction of transactions) {
		const resolved = lookup.get(
			normalizeCostLocation(transaction.cost_location_two),
		);
		const category = resolved?.label ?? FINANCE_UNMAPPED_CATEGORY;
		const bucket =
			byCategory.get(category) ??
			(() => {
				const created: CategoryBucket = {
					income: 0,
					expenses: 0,
					net: 0,
					count: 0,
					unmapped: !resolved?.label,
				};
				byCategory.set(category, created);
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
		[...byCategory.entries()]
			.map(([category, bucket]) => ({
				category,
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
			})
	);
}

// Build the rows the category editor shows: every stored label unioned with the
// second cost locations actually seen in the postings, enriched with usage
// stats so the LnF can tell which cost locations still need a label.
export function buildCategoryMappingRows(
	transactions: BuchhaltungsButlerTransaction[],
	mappings: FinanceCategoryMapping[],
): FinanceCategoryMappingRow[] {
	const lookup = buildCategoryLookup(mappings);
	const stats = new Map<
		string,
		{ count: number; net: number; sampleTexts: string[] }
	>();

	for (const transaction of transactions) {
		const key = normalizeCostLocation(transaction.cost_location_two);
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
					cost_location_two: key,
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
