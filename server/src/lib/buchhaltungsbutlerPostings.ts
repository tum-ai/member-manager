import {
	type BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionSchema,
	type BuchhaltungsButlerTransactionsQuery,
} from "@member-manager/shared";
import {
	BuchhaltungsButlerApiError,
	BuchhaltungsButlerConfigError,
	buildBuchhaltungsButlerAuthHeader,
	getBuchhaltungsButlerCredentials,
	normalizeBuchhaltungsButlerEndpoint,
} from "./buchhaltungsbutler.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const POSTINGS_PAGE_SIZE = 500;
const BB_POSTINGS_FETCH_TIMEOUT_MS = 30_000;

type BuchhaltungsButlerPostingsSource = "mock" | "real";

interface RawBuchhaltungsButlerPosting {
	id_by_customer?: unknown;
	date?: unknown;
	postingtext?: unknown;
	amount?: unknown;
	currency?: unknown;
	vat?: unknown;
	credit_type?: unknown;
	debit_postingaccount_number?: unknown;
	credit_postingaccount_number?: unknown;
	cost_location?: unknown;
	cost_location_two?: unknown;
	transaction_amount?: unknown;
	transaction_purpose?: unknown;
}

interface BuchhaltungsButlerPostingsPayload {
	data?: RawBuchhaltungsButlerPosting[];
	success?: boolean;
	message?: string;
	error?: string;
	error_code?: number;
}

export interface BuchhaltungsButlerPostingsResult {
	transactions: BuchhaltungsButlerTransaction[];
	source: BuchhaltungsButlerPostingsSource;
}

export function isBuchhaltungsButlerPostingsRealApiEnabled(): boolean {
	return (
		process.env.BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API === "true" ||
		process.env.BB_USE_REAL_API === "1"
	);
}

function parseAmount(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number.parseFloat(value.replace(",", "."));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
}

function getDefaultDateFrom(): string {
	return "2024-01-01";
}

function formatLocalDateInput(reference = new Date()): string {
	const year = reference.getFullYear();
	const month = String(reference.getMonth() + 1).padStart(2, "0");
	const day = String(reference.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function getDefaultBuchhaltungsButlerDateTo(
	reference = new Date(),
): string {
	return formatLocalDateInput(reference);
}

function inDateRange(
	transaction: BuchhaltungsButlerTransaction,
	query: BuchhaltungsButlerTransactionsQuery,
): boolean {
	return (
		(!query.date_from || transaction.date >= query.date_from) &&
		(!query.date_to || transaction.date <= query.date_to)
	);
}

function normalizePosting(
	item: RawBuchhaltungsButlerPosting,
): BuchhaltungsButlerTransaction {
	const signed = parseAmount(item.transaction_amount ?? item.amount);
	const transaction = {
		external_id: String(item.id_by_customer ?? ""),
		date: String(item.date ?? "").slice(0, 10),
		postingtext: String(item.postingtext ?? ""),
		amount: signed,
		currency: String(item.currency ?? "EUR"),
		vat: parseAmount(item.vat),
		credit_type: String(item.credit_type ?? ""),
		debit_postingaccount_number: String(item.debit_postingaccount_number ?? ""),
		credit_postingaccount_number: String(
			item.credit_postingaccount_number ?? "",
		),
		cost_location: String(item.cost_location ?? ""),
		cost_location_two: String(item.cost_location_two ?? ""),
		transaction_amount: signed,
		transaction_purpose: String(item.transaction_purpose ?? ""),
	};

	return BuchhaltungsButlerTransactionSchema.parse(transaction);
}

function addMockTransaction(
	rows: BuchhaltungsButlerTransaction[],
	input: {
		id: number;
		date: string;
		postingtext: string;
		amount: number;
		debitAccount: number;
		costLocation: number;
		costLocationTwo: number;
		transactionPurpose: string;
		vat?: number;
	},
): void {
	rows.push({
		external_id: `BB-${input.id}`,
		date: input.date,
		postingtext: input.postingtext,
		amount: Math.round(input.amount * 100) / 100,
		currency: "EUR",
		vat: input.vat ?? 0,
		credit_type: input.amount >= 0 ? "credit" : "debit",
		debit_postingaccount_number: String(input.debitAccount),
		credit_postingaccount_number: "1200",
		cost_location: String(input.costLocation),
		cost_location_two: String(input.costLocationTwo),
		transaction_amount: Math.round(input.amount * 100) / 100,
		transaction_purpose: input.transactionPurpose,
	});
}

function generateMockTransactions(): BuchhaltungsButlerTransaction[] {
	const rows: BuchhaltungsButlerTransaction[] = [];
	let uid = 1000;
	const add = (
		date: string,
		postingtext: string,
		amount: number,
		debitAccount: number,
		costLocation: number,
		costLocationTwo: number,
		transactionPurpose: string,
		vat = 0,
	) => {
		uid += 1;
		addMockTransaction(rows, {
			id: uid,
			date,
			postingtext,
			amount,
			debitAccount,
			costLocation,
			costLocationTwo,
			transactionPurpose,
			vat,
		});
	};

	add(
		"2026-01-20",
		"Sponsoring HRT",
		15000,
		8450,
		120,
		0,
		"Partnership HRT 2026",
	);
	add(
		"2026-02-14",
		"Sponsoring JetBrains",
		7500,
		8450,
		120,
		0,
		"JetBrains partnership tranche 1",
	);
	add(
		"2026-05-11",
		"Sponsoring JetBrains",
		7500,
		8450,
		120,
		0,
		"JetBrains partnership tranche 2",
	);
	add(
		"2026-03-02",
		"OpenAI x Make Sponsoring",
		6000,
		8450,
		161,
		0,
		"Makeathon sponsoring OpenAI",
	);
	add(
		"2026-04-22",
		"Hackathon League Funding",
		15000,
		8450,
		161,
		0,
		"Hackathon League tranche 1/2",
	);
	add(
		"2026-06-03",
		"E-Lab 2026 Partner",
		5000,
		8450,
		151,
		0,
		"AI E-Lab partner fee",
	);

	for (const [month, amount] of [
		[1, 380],
		[2, 240],
		[3, 160],
		[4, 420],
		[5, 300],
		[6, 180],
	] as const) {
		add(
			`2026-${String(month).padStart(2, "0")}-05`,
			"Mitgliedsbeiträge",
			amount,
			8110,
			182,
			0,
			`Member fees ${String(month).padStart(2, "0")}/2026`,
		);
	}
	add(
		"2026-02-27",
		"Spende Alumni",
		1200,
		8110,
		100,
		0,
		"Donation alumni network",
	);

	const tools = [
		["Netlify", -20, 130],
		["Vercel", -20, 130],
		["Tally", -17.5, 130],
		["Calendly", -30, 130],
		["Mailchimp", -45, 130],
		["Slack", -266, 130],
		["Buchhaltungsbutler", -37.5, 130],
		["Notion", -6, 130],
		["Cursor", -40, 130],
	] as const;
	for (let month = 1; month <= 7; month += 1) {
		for (const [name, amount, costLocation] of tools) {
			add(
				`2026-${String(month).padStart(2, "0")}-01`,
				`${name} subscription`,
				amount,
				6840,
				costLocation,
				5,
				`${name} monthly plan`,
				19,
			);
		}
	}

	add(
		"2026-04-18",
		"Onboarding SS Catering",
		-840,
		6810,
		111,
		1,
		"Onboarding weekend food",
	);
	add(
		"2026-04-18",
		"Onboarding SS Location",
		-600,
		6810,
		111,
		3,
		"Seminar room rent",
	);
	add(
		"2026-05-30",
		"TUM.ai days Party",
		-2100,
		6810,
		112,
		1,
		"Semester party catering",
	);
	add(
		"2026-06-12",
		"Retreat deposit",
		-5000,
		6810,
		112,
		2,
		"Retreat house deposit",
	);
	add(
		"2026-04-02",
		"Recruiting SS print",
		-740,
		6840,
		140,
		4,
		"Posters & flyers SS26",
	);
	add(
		"2026-04-09",
		"Recruiting SS ads",
		-1150,
		6840,
		140,
		8,
		"Social media ads",
	);
	add(
		"2026-02-20",
		"Camera equipment",
		-1234,
		6840,
		140,
		6,
		"Hardware for content team",
	);
	add(
		"2026-05-04",
		"Makeathon venue",
		-4800,
		6850,
		161,
		3,
		"Makeathon 2026 location",
	);
	add(
		"2026-05-04",
		"Makeathon catering",
		-3900,
		6850,
		161,
		1,
		"Makeathon 2026 food",
	);
	add(
		"2026-05-06",
		"Makeathon prizes",
		-1500,
		6850,
		161,
		7,
		"Prize money winners",
	);
	add("2026-03-15", "Canva Teams", -110, 6850, 160, 5, "Canva yearly plan");
	add(
		"2026-01-31",
		"Steuerberater Abschlag",
		-3750,
		6810,
		183,
		8,
		"Tax advisor Q1",
	);
	add(
		"2026-04-30",
		"Steuerberater Abschlag",
		-3750,
		6810,
		183,
		8,
		"Tax advisor Q2",
	);
	for (let month = 1; month <= 7; month += 1) {
		add(
			`2026-${String(month).padStart(2, "0")}-28`,
			"Kontoführung",
			-25,
			6810,
			185,
			8,
			"Banking fees",
		);
	}
	add(
		"2026-02-10",
		"Rechtsschutzversicherung",
		-980,
		6810,
		184,
		8,
		"Legal insurance 2026",
	);
	add("2026-03-21", "Notar", -600, 6810, 181, 8, "Notary board change");
	add("2026-06-20", "E-Lab demo day", -1400, 6850, 151, 1, "Demo day catering");
	add(
		"2026-05-25",
		"Med.ai compute",
		-520,
		6810,
		171,
		5,
		"Cloud compute Med.ai",
	);
	add(
		"2026-04-14",
		"Robotics parts",
		-760,
		6810,
		174,
		6,
		"Robotics taskforce hardware",
	);
	add(
		"2026-01-24",
		"Management Getaway",
		-900,
		6810,
		100,
		2,
		"Board strategy weekend",
	);
	add(
		"2025-10-06",
		"Onboarding WS Catering",
		-1150,
		6810,
		111,
		1,
		"Onboarding WS25/26 food",
	);
	add(
		"2025-10-20",
		"Recruiting WS ads",
		-980,
		6840,
		140,
		8,
		"Recruiting WS25/26",
	);
	add(
		"2025-11-14",
		"Unite Hackathon travel",
		-640,
		6850,
		161,
		2,
		"Team travel Unite",
	);
	add(
		"2025-12-01",
		"Sponsoring QuantCo",
		5000,
		8450,
		120,
		0,
		"QuantCo partnership",
	);
	add(
		"2025-12-15",
		"Mitgliedsbeiträge",
		450,
		8110,
		182,
		0,
		"Member fees 12/2025",
	);

	const noise = [
		["2026-06-04", -29, 110],
		["2026-06-09", -46, 130],
		["2026-02-24", -28, 110],
		["2026-06-24", -84, 110],
		["2026-05-14", -19, 110],
		["2026-01-07", -44, 130],
		["2026-05-20", -18, 140],
		["2026-06-23", -50, 140],
		["2026-02-15", -88, 110],
		["2026-02-23", -59, 160],
	] as const;
	for (const [date, amount, costLocation] of noise) {
		add(date, "Kleinmaterial", amount, 6810, costLocation, 4, "Consumables");
	}

	return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchRealTransactions(
	query: BuchhaltungsButlerTransactionsQuery,
): Promise<BuchhaltungsButlerTransaction[]> {
	const credentials = getBuchhaltungsButlerCredentials({
		requireSyncEnabled: false,
	});
	const dateFrom = query.date_from ?? getDefaultDateFrom();
	const dateTo = query.date_to ?? getDefaultBuchhaltungsButlerDateTo();
	const result: BuchhaltungsButlerTransaction[] = [];

	for (let offset = 0; ; offset += POSTINGS_PAGE_SIZE) {
		const response = await fetchWithTimeout(
			normalizeBuchhaltungsButlerEndpoint(credentials.baseUrl, "/postings/get"),
			{
				method: "POST",
				headers: {
					Authorization: buildBuchhaltungsButlerAuthHeader(credentials),
					"content-type": "application/json",
				},
				body: JSON.stringify({
					api_key: credentials.apiKey,
					limit: POSTINGS_PAGE_SIZE,
					offset,
					date_from: dateFrom,
					date_to: dateTo,
				}),
			},
			BB_POSTINGS_FETCH_TIMEOUT_MS,
		);

		let payload: BuchhaltungsButlerPostingsPayload;
		try {
			payload = (await response.json()) as BuchhaltungsButlerPostingsPayload;
		} catch {
			payload = {
				success: false,
				message: `BuchhaltungsButler returned ${response.status}`,
			};
		}

		if (!response.ok || payload.success === false) {
			throw new BuchhaltungsButlerApiError({
				message: String(
					payload.message ||
						payload.error ||
						"BuchhaltungsButler postings request failed",
				),
				statusCode: response.status,
				errorCode:
					typeof payload.error_code === "number"
						? payload.error_code
						: undefined,
			});
		}

		const pageData = Array.isArray(payload.data) ? payload.data : [];
		result.push(...pageData.map(normalizePosting));

		if (pageData.length < POSTINGS_PAGE_SIZE) {
			break;
		}
	}

	return result;
}

export async function getBuchhaltungsButlerTransactions(
	query: BuchhaltungsButlerTransactionsQuery,
): Promise<BuchhaltungsButlerPostingsResult> {
	if (isBuchhaltungsButlerPostingsRealApiEnabled()) {
		try {
			return {
				transactions: await fetchRealTransactions(query),
				source: "real",
			};
		} catch (error) {
			if (error instanceof BuchhaltungsButlerConfigError) {
				throw new BuchhaltungsButlerConfigError(
					"BuchhaltungsButler postings API is enabled but credentials are missing",
				);
			}
			throw error;
		}
	}

	if (process.env.NODE_ENV === "production") {
		throw new BuchhaltungsButlerConfigError(
			"BuchhaltungsButler postings API must be enabled in production",
		);
	}

	return {
		transactions: generateMockTransactions().filter((transaction) =>
			inDateRange(transaction, query),
		),
		source: "mock",
	};
}
