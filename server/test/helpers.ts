import "./setup.js";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { setSupabaseClient } from "../src/lib/supabase.js";
import {
	createMockSupabaseClient,
	MOCK_ADMIN_ID,
	MOCK_OTHER_USER_ID,
	MOCK_USER_ID,
	resetMockDatabase,
	VALID_ADMIN_TOKEN,
	VALID_OTHER_USER_TOKEN,
	VALID_USER_TOKEN,
} from "./mocks/supabase.js";

let testApp: FastifyInstance | null = null;
let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient> | null =
	null;

export async function getTestApp(): Promise<FastifyInstance> {
	if (testApp) {
		return testApp;
	}

	mockSupabaseClient = createMockSupabaseClient();
	setSupabaseClient(mockSupabaseClient);

	testApp = await buildApp();
	return testApp;
}

export async function closeTestApp(): Promise<void> {
	if (testApp) {
		await testApp.close();
		testApp = null;
		mockSupabaseClient = null;
	}
}

export function resetDatabase(): void {
	resetMockDatabase();
}

export function authHeaders(token: string): { authorization: string } {
	return { authorization: `Bearer ${token}` };
}

export const testTokens = {
	user: VALID_USER_TOKEN,
	admin: VALID_ADMIN_TOKEN,
	otherUser: VALID_OTHER_USER_TOKEN,
};

export const testUserIds = {
	user: MOCK_USER_ID,
	admin: MOCK_ADMIN_ID,
	otherUser: MOCK_OTHER_USER_ID,
};

export function mockMemberPayload(
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		user_id: MOCK_USER_ID,
		email: "newuser@test.com",
		given_name: "New",
		surname: "User",
		date_of_birth: "1995-05-15",
		street: "New St",
		number: "789",
		postal_code: "98765",
		city: "New City",
		country: "DE",
		phone: "+49111222333",
		salutation: "Mr",
		title: "",
		...overrides,
	};
}

export function mockSepaPayload(
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		user_id: MOCK_USER_ID,
		iban: "DE89370400440532013000",
		bic: "COBADEFFXXX",
		bank_name: "Test Bank",
		mandate_agreed: true,
		privacy_agreed: true,
		...overrides,
	};
}
