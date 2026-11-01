import "../setup.js";
import assert from "node:assert";
import { describe, test } from "node:test";
import type { User } from "@supabase/supabase-js";
import {
	getAllowedSlackTeamIds,
	getSlackTeamIds,
	isAllowedWorkspaceUser,
	isLocalSupabase,
	TUMAI_SLACK_TEAM_ID,
} from "../../src/lib/slackWorkspace.js";
import { mockSlackIdentity } from "../mocks/supabase.js";

const FOREIGN_TEAM_ID = "T999FOREIGN";

function user(overrides: Partial<User> = {}): User {
	return {
		id: "user-1",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
		...overrides,
	};
}

describe("slackWorkspace", () => {
	test("allows a Slack identity from the TUM.ai workspace", () => {
		const member = user({ identities: [mockSlackIdentity("user-1")] });
		assert.strictEqual(isAllowedWorkspaceUser(member), true);
		assert.deepStrictEqual(getSlackTeamIds(member), [TUMAI_SLACK_TEAM_ID]);
	});

	test("rejects a Slack identity from another workspace", () => {
		const outsider = user({
			identities: [mockSlackIdentity("user-1", FOREIGN_TEAM_ID)],
		});
		assert.strictEqual(isAllowedWorkspaceUser(outsider), false);
	});

	test("ignores a TUM.ai team id spoofed into user_metadata", () => {
		const outsider = user({
			user_metadata: {
				custom_claims: { "https://slack.com/team_id": TUMAI_SLACK_TEAM_ID },
			},
			identities: [mockSlackIdentity("user-1", FOREIGN_TEAM_ID)],
		});
		assert.strictEqual(isAllowedWorkspaceUser(outsider), false);
	});

	test("rejects a Slack identity without a team claim", () => {
		const identity = mockSlackIdentity("user-1");
		identity.identity_data = { sub: "U1" };
		assert.strictEqual(
			isAllowedWorkspaceUser(user({ identities: [identity] })),
			false,
		);
	});

	test("rejects when any linked Slack identity is foreign", () => {
		const mixed = user({
			identities: [
				mockSlackIdentity("user-1"),
				{
					...mockSlackIdentity("user-1", FOREIGN_TEAM_ID),
					identity_id: "second",
				},
			],
		});
		assert.strictEqual(isAllowedWorkspaceUser(mixed), false);
	});

	test("users without a Slack identity only pass against a local stack", () => {
		const emailUser = user({ identities: [] });
		assert.strictEqual(
			isAllowedWorkspaceUser(emailUser, { allowNonSlackUsers: false }),
			false,
		);
		assert.strictEqual(
			isAllowedWorkspaceUser(emailUser, { allowNonSlackUsers: true }),
			true,
		);
		// The test env points at https://test.supabase.co, which is not local.
		assert.strictEqual(isAllowedWorkspaceUser(user()), false);
	});

	test("an explicit allow-list replaces the default team", () => {
		const outsider = user({
			identities: [mockSlackIdentity("user-1", FOREIGN_TEAM_ID)],
		});
		assert.strictEqual(
			isAllowedWorkspaceUser(outsider, {
				allowedTeamIds: getAllowedSlackTeamIds(` ${FOREIGN_TEAM_ID} , `),
			}),
			true,
		);
		assert.deepStrictEqual(
			[...getAllowedSlackTeamIds(undefined)],
			[TUMAI_SLACK_TEAM_ID],
		);
		assert.deepStrictEqual(
			[...getAllowedSlackTeamIds(" , ")],
			[TUMAI_SLACK_TEAM_ID],
		);
	});

	test("isLocalSupabase only accepts loopback hosts outside production", () => {
		assert.strictEqual(isLocalSupabase("http://127.0.0.1:54321", "test"), true);
		assert.strictEqual(
			isLocalSupabase("http://localhost:54321", undefined),
			true,
		);
		assert.strictEqual(
			isLocalSupabase("http://127.0.0.1:54321", "production"),
			false,
		);
		assert.strictEqual(isLocalSupabase("https://x.supabase.co", "test"), false);
		assert.strictEqual(isLocalSupabase("not a url", "test"), false);
		assert.strictEqual(isLocalSupabase(undefined, "test"), false);
	});
});
