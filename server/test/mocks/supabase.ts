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
	member_agreements: Array<Record<string, unknown>>;
	user_roles: Array<Record<string, unknown>>;
	member_role_history: Array<Record<string, unknown>>;
	member_change_requests: Array<Record<string, unknown>>;
	engagement_certificate_requests: Array<Record<string, unknown>>;
	job_posting_requests: Array<Record<string, unknown>>;
	reimbursements: Array<Record<string, unknown>>;
	member_cvs: Array<Record<string, unknown>>;
	department_permissions: Array<Record<string, unknown>>;
	contract_templates: Array<Record<string, unknown>>;
	contract_template_variables: Array<Record<string, unknown>>;
	contract_conditional_blocks: Array<Record<string, unknown>>;
	contract_submissions: Array<Record<string, unknown>>;
	contract_document_versions: Array<Record<string, unknown>>;
	contract_partner_comments: Array<Record<string, unknown>>;
	contract_status_events: Array<Record<string, unknown>>;
	tumai_days: Array<Record<string, unknown>>;
	tumai_day_responses: Array<Record<string, unknown>>;
	finance_department_mappings: Array<Record<string, unknown>>;
	finance_category_mappings: Array<Record<string, unknown>>;
	finance_account_labels: Array<Record<string, unknown>>;
}

// In-memory stand-in for Supabase Storage objects, keyed by `${bucket}/${path}`.
export const mockStorage = new Map<string, Buffer>();

export const mockSupabaseErrors = {
	userRolesUpsert: null as unknown,
	tables: {} as Record<string, unknown>,
};

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
			board_role: null,
			research_project_id: null,
			degree: "B.Sc.",
			school: "TUM",
			linkedin_profile_url: null,
			public_location: null,
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
			department: "Legal & Finance",
			member_role: "Team Lead",
			board_role: "Board Member",
			research_project_id: null,
			degree: "M.Sc.",
			school: "TUM",
			linkedin_profile_url: null,
			public_location: null,
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
	member_agreements: [
		{
			user_id: MOCK_USER_ID,
			sepa_mandate_agreed: true,
			privacy_policy_agreed: true,
			data_privacy_notice_agreed: true,
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
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
	job_posting_requests: [],
	member_cvs: [],
	department_permissions: [
		{
			department: "Legal & Finance",
			permissions: ["finance.review", "contracts.admin"],
			updated_at: "2024-01-01T00:00:00Z",
			updated_by: MOCK_ADMIN_ID,
		},
		{
			department: "Partners & Sponsors",
			permissions: ["contracts.admin"],
			updated_at: "2026-06-02T00:00:00Z",
			updated_by: MOCK_ADMIN_ID,
		},
	],
	contract_templates: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			name: "Test Contract",
			description: null,
			contract_text: "Hello {{partner_name}}",
			is_active: true,
			created_at: "2026-05-27T12:00:00Z",
			updated_at: "2026-05-27T12:00:00Z",
		},
	],
	contract_template_variables: [
		{
			id: "22222222-2222-4222-8222-222222222222",
			template_id: "11111111-1111-4111-8111-111111111111",
			variable_name: "partner_name",
			label: "Partner Name",
			data_type: "TEXT",
			help_text: null,
			options: null,
			is_required: true,
			is_multiselect: false,
			show_if_variable: null,
			show_if_value: null,
			sort_order: 0,
			created_at: "2026-05-27T12:00:00Z",
			updated_at: "2026-05-27T12:00:00Z",
		},
	],
	contract_conditional_blocks: [],
	contract_document_versions: [],
	contract_partner_comments: [],
	contract_status_events: [],
	contract_submissions: [
		{
			id: "33333333-3333-4333-8333-333333333333",
			template_id: "11111111-1111-4111-8111-111111111111",
			submitter_user_id: MOCK_USER_ID,
			form_data: { partner_name: "Acme" },
			generated_contract_text: "Hello Acme",
			admin_edited_text: null,
			status: "legal_review",
			notes: null,
			feedback_message: null,
			signature_token: null,
			signature_token_expires_at: null,
			signature_data: null,
			signer_name: null,
			signed_at: null,
			admin_signature_data: null,
			admin_signer_name: null,
			admin_signed_at: null,
			sent_to_partner_at: null,
			partner_email_sent_at: null,
			partner_email_recipient: null,
			partner_email_error: null,
			clarification_email_sent_at: null,
			clarification_email_recipient: null,
			clarification_email_error: null,
			signature_provider: "in_app",
			opensign_document_id: null,
			opensign_status: null,
			opensign_sent_at: null,
			opensign_completed_at: null,
			opensign_file_url: null,
			opensign_certificate_url: null,
			opensign_error: null,
			opensign_webhook_last_event: null,
			opensign_webhook_received_at: null,
			partner_comment: null,
			partner_commented_at: null,
			final_pdf_token: null,
			final_pdf_sent_at: null,
			completed_at: null,
			active_document_version_id: null,
			sent_document_version_id: null,
			final_document_version_id: null,
			submitted_at: "2026-05-27T12:00:00Z",
			created_at: "2026-05-27T12:00:00Z",
			updated_at: "2026-05-27T12:00:00Z",
		},
	],
	reimbursements: [
		{
			id: "reimbursement-older",
			user_id: MOCK_USER_ID,
			amount: 25.5,
			date: "2026-03-20",
			description: "Snacks for member onboarding",
			department: "Community",
			submission_type: "reimbursement",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
			receipt_filename: "older.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "pending",
			payment_status: "to_be_paid",
			rejection_reason: null,
			created_at: "2026-03-20T10:00:00Z",
			updated_at: "2026-03-20T10:00:00Z",
		},
		{
			id: "reimbursement-newer",
			user_id: MOCK_USER_ID,
			amount: 80,
			date: "2026-04-12",
			description: "Venue supplies",
			department: "Makeathon",
			submission_type: "invoice",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
			receipt_filename: "newer.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "approved",
			payment_status: "to_be_paid",
			rejection_reason: null,
			created_at: "2026-04-12T10:00:00Z",
			updated_at: "2026-04-12T10:00:00Z",
		},
		{
			id: "other-user-reimbursement",
			user_id: MOCK_OTHER_USER_ID,
			amount: 12,
			date: "2026-04-13",
			description: "Other user's request",
			department: "Marketing",
			submission_type: "reimbursement",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
			receipt_filename: "other.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "pending",
			payment_status: "to_be_paid",
			rejection_reason: null,
			created_at: "2026-04-13T10:00:00Z",
			updated_at: "2026-04-13T10:00:00Z",
		},
	],
	tumai_days: [],
	tumai_day_responses: [],
	finance_department_mappings: [],
	finance_category_mappings: [],
	finance_account_labels: [],
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
	lte: (column: string, value: unknown) => QueryBuilder;
	is: (column: string, value: unknown) => QueryBuilder;
	in: (column: string, values: unknown[]) => QueryBuilder;
	or: (query: string) => QueryBuilder;
	order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
	range: (from: number, to: number) => QueryBuilder;
	limit: (count: number) => QueryBuilder;
	single: () => QueryResult;
	maybeSingle: () => QueryResult;
}

function createQueryBuilder(table: string): QueryBuilder {
	const state = {
		selectedColumns: "*",
		forcedError: null as unknown,
		filters: [] as Array<{ column: string; value: unknown }>,
		lteFilters: [] as Array<{ column: string; value: unknown }>,
		isFilters: [] as Array<{ column: string; value: unknown }>,
		inFilters: [] as Array<{ column: string; values: unknown[] }>,
		limitCount: undefined as number | undefined,
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

	const execute = (isSingle = false, isMaybeSingle = false) => {
		if (state.forcedError) {
			return Promise.resolve({ data: null, error: state.forcedError });
		}
		if (mockSupabaseErrors.tables[table]) {
			return Promise.resolve({
				data: null,
				error: mockSupabaseErrors.tables[table],
			});
		}

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

		for (const filter of state.filters) {
			tableData = tableData.filter(
				(row) => row[filter.column] === filter.value,
			);
		}

		for (const filter of state.lteFilters) {
			tableData = tableData.filter((row) => {
				const val = row[filter.column];
				if (
					val === undefined ||
					val === null ||
					filter.value === undefined ||
					filter.value === null
				) {
					return false;
				}
				return String(val) <= String(filter.value);
			});
		}

		for (const filter of state.inFilters) {
			tableData = tableData.filter((row) =>
				filter.values.includes(row[filter.column]),
			);
		}

		// `.is(col, null)` / `.is(col, value)` — used by current-CV lookups.
		for (const filter of state.isFilters) {
			tableData = tableData.filter((row) => {
				const value = row[filter.column];
				if (filter.value === null) {
					return value === null || value === undefined;
				}
				return value === filter.value;
			});
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
				const key = row.id ?? row.user_id ?? row.id_uuid;
				const updated = realTable.find(
					(candidate) =>
						(candidate.id ?? candidate.user_id ?? candidate.id_uuid) === key,
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
				const agreementData = mockDatabase.member_agreements.find(
					(agreement) => agreement.user_id === member.user_id,
				);
				return {
					...member,
					sepa: sepaData || {},
					member_agreements: agreementData || {},
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

		if (state.limitCount !== undefined) {
			tableData = tableData.slice(0, state.limitCount);
		}

		if (isSingle) {
			if (tableData.length === 0) {
				if (isMaybeSingle) {
					return Promise.resolve({ data: null, error: null });
				}
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
						table === "engagement_certificate_requests" ||
						table === "job_posting_requests" ||
						table === "reimbursements" ||
						table === "member_cvs" ||
						table === "contract_templates" ||
						table === "contract_template_variables" ||
						table === "contract_conditional_blocks" ||
						table === "contract_submissions" ||
						table === "contract_document_versions" ||
						table === "contract_partner_comments" ||
						table === "contract_status_events" ||
						table === "tumai_days" ||
						table === "tumai_day_responses") &&
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
			if (table === "user_roles" && mockSupabaseErrors.userRolesUpsert) {
				state.forcedError = mockSupabaseErrors.userRolesUpsert;
				return proxyBuilder;
			}

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

		lte: (column: string, value: unknown) => {
			state.lteFilters.push({ column, value });
			return proxyBuilder;
		},

		is: (column: string, value: unknown) => {
			state.isFilters.push({ column, value });
			return proxyBuilder;
		},

		in: (column: string, values: unknown[]) => {
			state.inFilters.push({ column, values });
			return proxyBuilder;
		},

		limit: (count: number) => {
			state.limitCount = count;
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
		maybeSingle: () => execute(true, true),
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
		// Mirrors the insert_member_cv_version RPC: read max version, demote the
		// current row, insert the new current row — atomically from the caller's
		// perspective. Returns a `.single()`-shaped thenable.
		rpc: (fnName: string, params: Record<string, unknown>) => {
			const run = () => {
				if (fnName !== "insert_member_cv_version") {
					return Promise.resolve({
						data: null,
						error: { message: `Unknown rpc ${fnName}` },
					});
				}
				const rows = mockDatabase.member_cvs;
				const userId = params.p_user_id;
				const userRows = rows.filter((r) => r.user_id === userId);
				const prev = userRows.sort(
					(a, b) => Number(b.version) - Number(a.version),
				)[0];
				const nextVersion = (prev ? Number(prev.version) : 0) + 1;
				for (const row of userRows) {
					row.is_current = false;
				}
				const inserted: Record<string, unknown> = {
					id: params.p_id,
					user_id: params.p_user_id,
					storage_bucket: params.p_storage_bucket,
					storage_path: params.p_storage_path,
					original_filename: params.p_original_filename,
					mime_type: params.p_mime_type,
					size_bytes: params.p_size_bytes,
					sha256: params.p_sha256,
					source: params.p_source,
					version: nextVersion,
					is_current: true,
					uploaded_by_user_id: params.p_uploaded_by_user_id ?? null,
					supersedes_cv_id: prev?.id ?? null,
					revoked_at: null,
					uploaded_at: new Date().toISOString(),
					created_at: new Date().toISOString(),
				};
				rows.push(inserted);
				return Promise.resolve({ data: inserted, error: null });
			};
			// The lib only consumes `.rpc(...).single()`.
			return { single: () => run() };
		},
		storage: {
			from: (bucket: string) => ({
				createSignedUploadUrl: async (path: string) => ({
					data: {
						path,
						token: `upload-token-${path}`,
						signedUrl: `https://mock-storage.local/${bucket}/${path}?upload=1`,
					},
					error: null,
				}),
				upload: async (path: string, body: Buffer, _options?: unknown) => {
					const key = `${bucket}/${path}`;
					if (mockStorage.has(key)) {
						return { data: null, error: { message: "Already exists" } };
					}
					mockStorage.set(key, Buffer.from(body));
					return { data: { path }, error: null };
				},
				download: async (path: string) => {
					const value = mockStorage.get(`${bucket}/${path}`);
					if (!value) {
						return { data: null, error: { message: "Not found" } };
					}
					return {
						data: {
							arrayBuffer: async () =>
								value.buffer.slice(
									value.byteOffset,
									value.byteOffset + value.byteLength,
								),
						},
						error: null,
					};
				},
				createSignedUrl: async (
					path: string,
					expiresIn: number,
					options?: { download?: string | boolean },
				) => {
					const download =
						typeof options?.download === "string"
							? `&download=${encodeURIComponent(options.download)}`
							: options?.download
								? "&download=1"
								: "";
					return {
						data: {
							signedUrl: `https://mock-storage.local/${bucket}/${path}?token=mock&exp=${expiresIn}${download}`,
						},
						error: null,
					};
				},
				remove: async (paths: string[]) => {
					for (const path of paths) {
						mockStorage.delete(`${bucket}/${path}`);
					}
					return { data: null, error: null };
				},
			}),
		},
	} as unknown as SupabaseClient;
}

export function resetMockDatabase(): void {
	mockSupabaseErrors.userRolesUpsert = null;
	mockSupabaseErrors.tables = {};
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
			board_role: null,
			research_project_id: null,
			degree: "B.Sc.",
			school: "TUM",
			linkedin_profile_url: null,
			public_location: null,
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
			department: "Legal & Finance",
			member_role: "Team Lead",
			board_role: "Board Member",
			research_project_id: null,
			degree: "M.Sc.",
			school: "TUM",
			linkedin_profile_url: null,
			public_location: null,
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

	mockDatabase.member_agreements = [
		{
			user_id: MOCK_USER_ID,
			sepa_mandate_agreed: true,
			privacy_policy_agreed: true,
			data_privacy_notice_agreed: true,
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
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
	mockDatabase.job_posting_requests = [];
	mockDatabase.member_cvs = [];
	mockDatabase.department_permissions = [
		{
			department: "Legal & Finance",
			permissions: ["finance.review", "contracts.admin"],
			updated_at: "2024-01-01T00:00:00Z",
			updated_by: MOCK_ADMIN_ID,
		},
		{
			department: "Partners & Sponsors",
			permissions: ["contracts.admin"],
			updated_at: "2026-06-02T00:00:00Z",
			updated_by: MOCK_ADMIN_ID,
		},
	];
	mockDatabase.contract_templates = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			name: "Test Contract",
			description: null,
			contract_text: "Hello {{partner_name}}",
			is_active: true,
			created_at: "2026-05-27T12:00:00Z",
			updated_at: "2026-05-27T12:00:00Z",
		},
	];
	mockDatabase.contract_template_variables = [
		{
			id: "22222222-2222-4222-8222-222222222222",
			template_id: "11111111-1111-4111-8111-111111111111",
			variable_name: "partner_name",
			label: "Partner Name",
			data_type: "TEXT",
			help_text: null,
			options: null,
			is_required: true,
			is_multiselect: false,
			show_if_variable: null,
			show_if_value: null,
			sort_order: 0,
			created_at: "2026-05-27T12:00:00Z",
			updated_at: "2026-05-27T12:00:00Z",
		},
	];
	mockDatabase.contract_conditional_blocks = [];
	mockDatabase.contract_document_versions = [];
	mockDatabase.contract_partner_comments = [];
	mockDatabase.contract_status_events = [];
	mockDatabase.contract_submissions = [
		{
			id: "33333333-3333-4333-8333-333333333333",
			template_id: "11111111-1111-4111-8111-111111111111",
			submitter_user_id: MOCK_USER_ID,
			form_data: { partner_name: "Acme" },
			generated_contract_text: "Hello Acme",
			admin_edited_text: null,
			status: "legal_review",
			notes: null,
			feedback_message: null,
			signature_token: null,
			signature_token_expires_at: null,
			signature_data: null,
			signer_name: null,
			signed_at: null,
			admin_signature_data: null,
			admin_signer_name: null,
			admin_signed_at: null,
			sent_to_partner_at: null,
			partner_email_sent_at: null,
			partner_email_recipient: null,
			partner_email_error: null,
			clarification_email_sent_at: null,
			clarification_email_recipient: null,
			clarification_email_error: null,
			signature_provider: "in_app",
			opensign_document_id: null,
			opensign_status: null,
			opensign_sent_at: null,
			opensign_completed_at: null,
			opensign_file_url: null,
			opensign_certificate_url: null,
			opensign_error: null,
			opensign_webhook_last_event: null,
			opensign_webhook_received_at: null,
			partner_comment: null,
			partner_commented_at: null,
			final_pdf_token: null,
			final_pdf_sent_at: null,
			completed_at: null,
			active_document_version_id: null,
			sent_document_version_id: null,
			final_document_version_id: null,
			submitted_at: "2026-05-27T12:00:00Z",
			created_at: "2026-05-27T12:00:00Z",
			updated_at: "2026-05-27T12:00:00Z",
		},
	];
	mockStorage.clear();
	mockDatabase.reimbursements = [
		{
			id: "reimbursement-older",
			user_id: MOCK_USER_ID,
			amount: 25.5,
			date: "2026-03-20",
			description: "Snacks for member onboarding",
			department: "Community",
			submission_type: "reimbursement",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
			receipt_filename: "older.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "pending",
			payment_status: "to_be_paid",
			rejection_reason: null,
			created_at: "2026-03-20T10:00:00Z",
			updated_at: "2026-03-20T10:00:00Z",
		},
		{
			id: "reimbursement-newer",
			user_id: MOCK_USER_ID,
			amount: 80,
			date: "2026-04-12",
			description: "Venue supplies",
			department: "Makeathon",
			submission_type: "invoice",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
			receipt_filename: "newer.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "approved",
			payment_status: "to_be_paid",
			rejection_reason: null,
			created_at: "2026-04-12T10:00:00Z",
			updated_at: "2026-04-12T10:00:00Z",
		},
		{
			id: "other-user-reimbursement",
			user_id: MOCK_OTHER_USER_ID,
			amount: 12,
			date: "2026-04-13",
			description: "Other user's request",
			department: "Marketing",
			submission_type: "reimbursement",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
			receipt_filename: "other.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "pending",
			payment_status: "to_be_paid",
			rejection_reason: null,
			created_at: "2026-04-13T10:00:00Z",
			updated_at: "2026-04-13T10:00:00Z",
		},
	];
	mockDatabase.tumai_days = [];
	mockDatabase.tumai_day_responses = [];
	mockDatabase.finance_department_mappings = [];
	mockDatabase.finance_category_mappings = [];
	mockDatabase.finance_account_labels = [];
}
