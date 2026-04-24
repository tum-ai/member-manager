import type { SupabaseClient, User } from "@supabase/supabase-js";

export const MOCK_USER_ID = "user-123";
export const MOCK_ADMIN_ID = "admin-456";
export const MOCK_OTHER_USER_ID = "user-789";

export const VALID_USER_TOKEN = "valid-user-token";
export const VALID_ADMIN_TOKEN = "valid-admin-token";
export const VALID_OTHER_USER_TOKEN = "valid-other-user-token";
export const INVALID_TOKEN = "invalid-token";

export const mockUsers: Record<string, User> = {
	[VALID_USER_TOKEN]: {
		id: MOCK_USER_ID,
		email: "user@test.com",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
	},
	[VALID_ADMIN_TOKEN]: {
		id: MOCK_ADMIN_ID,
		email: "admin@test.com",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
	},
	[VALID_OTHER_USER_TOKEN]: {
		id: MOCK_OTHER_USER_ID,
		email: "other@test.com",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
	},
};

interface MockData {
	members: Array<Record<string, unknown>>;
	sepa: Array<Record<string, unknown>>;
	user_roles: Array<Record<string, unknown>>;
	member_role_history: Array<Record<string, unknown>>;
	member_change_requests: Array<Record<string, unknown>>;
	engagement_certificate_requests: Array<Record<string, unknown>>;
}

export const mockDatabase: MockData = {
	members: [
		{
			user_id: MOCK_USER_ID,
			given_name: "Test",
			surname: "User",
			date_of_birth: "1990-01-01",
			street: "Test St",
			number: "123",
			postal_code: "12345",
			city: "Test City",
			country: "DE",
			phone: "+49123456789",
			active: true,
			member_status: "active",
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Mr",
			title: "",
			batch: "WS23",
			department: "Software Development",
			member_role: "Member",
			degree: "B.Sc.",
			school: "TUM",
		},
		{
			user_id: MOCK_ADMIN_ID,
			given_name: "Admin",
			surname: "User",
			date_of_birth: "1985-01-01",
			street: "Admin St",
			number: "456",
			postal_code: "54321",
			city: "Admin City",
			country: "DE",
			phone: "+49987654321",
			active: true,
			member_status: "active",
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Ms",
			title: "Dr",
			batch: "WS22",
			department: "Board",
			member_role: "Team Lead",
			degree: "M.Sc.",
			school: "TUM",
		},
	],
	sepa: [
		{
			id_uuid: "sepa-uuid-1",
			user_id: MOCK_USER_ID,
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Test Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			created_at: "2024-01-01T00:00:00Z",
		},
	],
	user_roles: [
		{
			user_id: MOCK_USER_ID,
			role: "user",
		},
		{
			user_id: MOCK_ADMIN_ID,
			role: "admin",
		},
	],
	member_role_history: [],
	member_change_requests: [],
	engagement_certificate_requests: [],
};

type QueryResult = Promise<{
	data: unknown;
	error: unknown;
	count?: number | null;
}>;

interface QueryBuilder {
	select: (columns?: string, config?: { count?: string }) => QueryBuilder;
	insert: (data: unknown) => QueryBuilder;
	update: (data: Record<string, unknown>) => QueryBuilder;
	upsert: (
		data: Record<string, unknown> | Array<Record<string, unknown>>,
		options?: { onConflict?: string; ignoreDuplicates?: boolean },
	) => QueryBuilder;
	delete: () => QueryBuilder;
	eq: (column: string, value: unknown) => QueryBuilder;
	in: (column: string, values: unknown[]) => QueryBuilder;
	or: (query: string) => QueryBuilder;
	order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
	range: (from: number, to: number) => QueryBuilder;
	single: () => QueryResult;
}

function createQueryBuilder(table: string): QueryBuilder {
	const state = {
		selectedColumns: "*",
		filters: [] as Array<{ column: string; value: unknown }>,
		inFilters: [] as Array<{ column: string; values: unknown[] }>,
		orQuery: "" as string,
		orderByConfig: undefined as
			| { column: string; ascending: boolean }
			| undefined,
		rangeConfig: undefined as { from: number; to: number } | undefined,
		selectConfig: undefined as { count?: string } | undefined,
		insertedData: null as Array<Record<string, unknown>> | null,
		// Pending UPDATE payload. Applied at execute() time so filters set via
		// `.eq()` AFTER `.update()` still take effect (real PostgREST usage).
		pendingUpdate: null as Record<string, unknown> | null,
		pendingDelete: false,
	};

	const execute = (isSingle = false) => {
		let tableData: Array<Record<string, unknown>>;

		// If we just inserted data, return that instead of querying
		if (state.insertedData) {
			tableData = [...state.insertedData];
		} else {
			tableData = [...(mockDatabase[table as keyof MockData] || [])];
		}

		// Apply OR filters (for search)
		if (state.orQuery) {
			const orConditions = state.orQuery.split(",");
			tableData = tableData.filter((row) => {
				return orConditions.some((condition) => {
					const match = condition.match(/(\w+)\.ilike\.%(.+)%/);
					if (match) {
						const [, column, searchTerm] = match;
						const value = String(row[column] || "").toLowerCase();
						return value.includes(searchTerm.toLowerCase());
					}
					return false;
				});
			});
		}

		// Apply EQ filters
		for (const filter of state.filters) {
			tableData = tableData.filter(
				(row) => row[filter.column] === filter.value,
			);
		}

		for (const filter of state.inFilters) {
			tableData = tableData.filter((row) =>
				filter.values.includes(row[filter.column]),
			);
		}

		// Apply a pending UPDATE now that filters are known. Mutates the real
		// mockDatabase[table] in place so subsequent reads observe the change.
		if (state.pendingUpdate && !state.insertedData) {
			const realTable = mockDatabase[table as keyof MockData];
			for (let i = 0; i < realTable.length; i++) {
				const row = realTable[i];
				const matches = state.filters.every((f) => row[f.column] === f.value);
				if (matches) {
					realTable[i] = { ...realTable[i], ...state.pendingUpdate };
				}
			}
			tableData = tableData.map((row) => {
				const key = row.user_id ?? row.id ?? row.id_uuid;
				const updated = realTable.find(
					(candidate) =>
						(candidate.user_id ?? candidate.id ?? candidate.id_uuid) === key,
				);
				return updated ? { ...updated } : row;
			});
		}

		// Apply a pending DELETE now that filters are known.
		if (state.pendingDelete && !state.insertedData) {
			const realTable = mockDatabase[table as keyof MockData];
			const keep: Array<Record<string, unknown>> = [];
			for (const row of realTable) {
				const matches = state.filters.every((f) => row[f.column] === f.value);
				if (!matches) keep.push(row);
			}
			realTable.length = 0;
			realTable.push(...keep);
			tableData = [];
		}

		// Handle joins for admin members query
		if (table === "members" && state.selectedColumns.includes("sepa")) {
			tableData = tableData.map((member) => {
				const sepaData = mockDatabase.sepa.find(
					(s) => s.user_id === member.user_id,
				);
				return {
					...member,
					sepa: sepaData || {},
				};
			});
		}

		if (state.orderByConfig) {
			const { column, ascending } = state.orderByConfig;
			tableData.sort((a, b) => {
				const aVal = a[column];
				const bVal = b[column];
				if (aVal < bVal) return ascending ? -1 : 1;
				if (aVal > bVal) return ascending ? 1 : -1;
				return 0;
			});
		}

		let count: number | null = null;
		if (state.selectConfig?.count === "exact") {
			count = tableData.length;
		}

		if (state.rangeConfig) {
			const { from, to } = state.rangeConfig;
			tableData = tableData.slice(from, to + 1);
		}

		if (isSingle) {
			if (tableData.length === 0) {
				return Promise.resolve({
					data: null,
					error: { code: "PGRST116", message: "Not found" },
				});
			}
			return Promise.resolve({ data: tableData[0], error: null });
		}

		const result: {
			data: unknown;
			error: null;
			count?: number | null;
		} = { data: tableData, error: null };
		if (count !== null) {
			result.count = count;
		}

		return Promise.resolve(result);
	};

	const builder: QueryBuilder = {
		select: (columns = "*", config?: { count?: string }) => {
			state.selectedColumns = columns;
			state.selectConfig = config;
			return proxyBuilder;
		},

		insert: (data: unknown) => {
			const tableData = mockDatabase[table as keyof MockData];
			const records = (Array.isArray(data) ? data : [data]).map((r) => {
				const rec = r as Record<string, unknown>;
				// Auto-assign an id for tables that use UUID PKs (the real schema
				// has `default gen_random_uuid()`). Without this, INSERTs followed
				// by SELECT/DELETE-by-id don't line up in tests.
				if (
					(table === "member_role_history" ||
						table === "member_change_requests" ||
						table === "engagement_certificate_requests") &&
					rec.id === undefined &&
					rec.id_uuid === undefined
				) {
					rec.id = `mock-${Math.random().toString(36).slice(2, 10)}`;
				}
				if (rec.created_at === undefined) {
					rec.created_at = new Date().toISOString();
				}
				return rec;
			});
			tableData.push(...records);
			state.insertedData = records as Array<Record<string, unknown>>;
			return proxyBuilder;
		},

		update: (data: Record<string, unknown>) => {
			// Defer the actual mutation to execute() so that any `.eq()` filters
			// chained AFTER `.update(...)` are respected.
			state.pendingUpdate = data;
			return proxyBuilder;
		},

		delete: () => {
			state.pendingDelete = true;
			return proxyBuilder;
		},

		upsert: (
			data: Record<string, unknown> | Array<Record<string, unknown>>,
			options?: { onConflict?: string; ignoreDuplicates?: boolean },
		) => {
			const tableData = mockDatabase[table as keyof MockData];
			const records = Array.isArray(data) ? data : [data];
			const upsertedRecords: Array<Record<string, unknown>> = [];

			for (const record of records) {
				const conflictKey = options?.onConflict || "user_id";
				const existingIndex = tableData.findIndex(
					(row) => row[conflictKey] === record[conflictKey],
				);

				if (existingIndex !== -1) {
					if (!options?.ignoreDuplicates) {
						tableData[existingIndex] = {
							...tableData[existingIndex],
							...record,
						};
					}
					upsertedRecords.push({
						...tableData[existingIndex],
					});
				} else {
					tableData.push(record);
					upsertedRecords.push({ ...record });
				}
			}
			state.insertedData = upsertedRecords;
			return proxyBuilder;
		},

		eq: (column: string, value: unknown) => {
			state.filters.push({ column, value });
			return proxyBuilder;
		},

		in: (column: string, values: unknown[]) => {
			state.inFilters.push({ column, values });
			return proxyBuilder;
		},

		or: (query: string) => {
			state.orQuery = query;
			return proxyBuilder;
		},

		order: (column: string, options?: { ascending?: boolean }) => {
			state.orderByConfig = { column, ascending: options?.ascending ?? true };
			return proxyBuilder;
		},

		range: (from: number, to: number) => {
			state.rangeConfig = { from, to };
			return proxyBuilder;
		},

		single: () => execute(true),
	};

	const proxyBuilder = new Proxy(builder, {
		get(target, prop) {
			if (prop in target) {
				return target[prop as keyof QueryBuilder];
			}
			if (prop === "then") {
				const promise = execute(false);
				return promise.then.bind(promise);
			}
			if (prop === "catch") {
				const promise = execute(false);
				return promise.catch.bind(promise);
			}
			return undefined;
		},
	}) as QueryBuilder;

	return proxyBuilder;
}

export function createMockSupabaseClient(): SupabaseClient {
	return {
		auth: {
			getUser: async (token: string) => {
				const user = mockUsers[token];
				if (user) {
					return { data: { user }, error: null };
				}
				return {
					data: { user: null },
					error: { message: "Invalid token", status: 401 },
				};
			},
			admin: {
				getUserById: async (userId: string) => {
					const user = Object.values(mockUsers).find(
						(candidate) => candidate.id === userId,
					);

					if (user) {
						return { data: { user }, error: null };
					}

					return {
						data: { user: null },
						error: { message: "User not found", status: 404 },
					};
				},
				listUsers: async ({
					page = 1,
					perPage = 1000,
				}: {
					page?: number;
					perPage?: number;
				} = {}) => {
					const allUsers = Object.values(mockUsers);
					const from = (page - 1) * perPage;
					const to = from + perPage;

					return {
						data: {
							users: allUsers.slice(from, to),
						},
						error: null,
					};
				},
			},
		},
		from: (table: string) => createQueryBuilder(table),
	} as unknown as SupabaseClient;
}

export function resetMockDatabase(): void {
	mockDatabase.members = [
		{
			user_id: MOCK_USER_ID,
			given_name: "Test",
			surname: "User",
			date_of_birth: "1990-01-01",
			street: "Test St",
			number: "123",
			postal_code: "12345",
			city: "Test City",
			country: "DE",
			phone: "+49123456789",
			active: true,
			member_status: "active",
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Mr",
			title: "",
			batch: "WS23",
			department: "Software Development",
			member_role: "Member",
			degree: "B.Sc.",
			school: "TUM",
		},
		{
			user_id: MOCK_ADMIN_ID,
			given_name: "Admin",
			surname: "User",
			date_of_birth: "1985-01-01",
			street: "Admin St",
			number: "456",
			postal_code: "54321",
			city: "Admin City",
			country: "DE",
			phone: "+49987654321",
			active: true,
			member_status: "active",
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Ms",
			title: "Dr",
			batch: "WS22",
			department: "Board",
			member_role: "Team Lead",
			degree: "M.Sc.",
			school: "TUM",
		},
	];

	mockDatabase.sepa = [
		{
			id_uuid: "sepa-uuid-1",
			user_id: MOCK_USER_ID,
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Test Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			created_at: "2024-01-01T00:00:00Z",
		},
	];

	mockDatabase.user_roles = [
		{
			user_id: MOCK_USER_ID,
			role: "user",
		},
		{
			user_id: MOCK_ADMIN_ID,
			role: "admin",
		},
	];

	mockDatabase.member_role_history = [];
	mockDatabase.member_change_requests = [];
	mockDatabase.engagement_certificate_requests = [];
}
