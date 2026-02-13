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
}

export const mockDatabase: MockData = {
	members: [
		{
			user_id: MOCK_USER_ID,
			email: "user@test.com",
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
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Mr",
			title: "",
			batch: "WS23/24",
			department: "Tech",
			member_role: "Software Engineer",
			degree: "B.Sc.",
			school: "TUM",
			skills: ["TypeScript", "React", "Node.js"],
			profile_picture_url: null,
		},
		{
			user_id: MOCK_ADMIN_ID,
			email: "admin@test.com",
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
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Ms",
			title: "Dr",
			batch: "WS22/23",
			department: "Management",
			member_role: "Team Lead",
			degree: "M.Sc.",
			school: "TUM",
			skills: ["Leadership", "Python"],
			profile_picture_url: null,
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
	eq: (column: string, value: unknown) => QueryBuilder;
	or: (query: string) => QueryBuilder;
	order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
	range: (from: number, to: number) => QueryBuilder;
	single: () => QueryResult;
}

function createQueryBuilder(table: string): QueryBuilder {
	const state = {
		selectedColumns: "*",
		filters: [] as Array<{ column: string; value: unknown }>,
		orQuery: "" as string,
		orderByConfig: undefined as
			| { column: string; ascending: boolean }
			| undefined,
		rangeConfig: undefined as { from: number; to: number } | undefined,
		selectConfig: undefined as { count?: string } | undefined,
		insertedData: null as Array<Record<string, unknown>> | null,
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
			const records = Array.isArray(data) ? data : [data];
			tableData.push(...records);
			state.insertedData = records as Array<Record<string, unknown>>;
			return proxyBuilder;
		},

		update: (data: Record<string, unknown>) => {
			const tableData = mockDatabase[table as keyof MockData];
			for (const filter of state.filters) {
				const index = tableData.findIndex(
					(row) => row[filter.column] === filter.value,
				);
				if (index !== -1) {
					tableData[index] = { ...tableData[index], ...data };
				}
			}
			return proxyBuilder;
		},

		upsert: (
			data: Record<string, unknown> | Array<Record<string, unknown>>,
			options?: { onConflict?: string; ignoreDuplicates?: boolean },
		) => {
			const tableData = mockDatabase[table as keyof MockData];
			const records = Array.isArray(data) ? data : [data];

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
				} else {
					tableData.push(record);
				}
			}
			return proxyBuilder;
		},

		eq: (column: string, value: unknown) => {
			state.filters.push({ column, value });
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
		},
		from: (table: string) => createQueryBuilder(table),
	} as unknown as SupabaseClient;
}

export function resetMockDatabase(): void {
	mockDatabase.members = [
		{
			user_id: MOCK_USER_ID,
			email: "user@test.com",
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
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Mr",
			title: "",
			batch: "WS23/24",
			department: "Tech",
			member_role: "Software Engineer",
			degree: "B.Sc.",
			school: "TUM",
			skills: ["TypeScript", "React", "Node.js"],
			profile_picture_url: null,
		},
		{
			user_id: MOCK_ADMIN_ID,
			email: "admin@test.com",
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
			created_at: "2024-01-01T00:00:00Z",
			salutation: "Ms",
			title: "Dr",
			batch: "WS22/23",
			department: "Management",
			member_role: "Team Lead",
			degree: "M.Sc.",
			school: "TUM",
			skills: ["Leadership", "Python"],
			profile_picture_url: null,
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
}
