import "../setup.js";
import assert from "node:assert";
import { afterEach, describe, test } from "node:test";
import type { User } from "@supabase/supabase-js";
import {
	allowsNonSlackUsers,
	getSlackTeamIds,
	isAllowedWorkspaceUser,
	isLocalSupabase,
	setAllowNonSlackUsers,
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
	afterEach(() => {
		setAllowNonSlackUsers(false);
	});

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
		// Foreign Slack users stay out even where email users are allowed.
		assert.strictEqual(isAllowedWorkspaceUser(outsider, true), false);
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

	test("keeps a member who also linked a Slack identity from another workspace", () => {
		const member = user({
			identities: [
				mockSlackIdentity("user-1"),
				{
					...mockSlackIdentity("user-1", FOREIGN_TEAM_ID),
					identity_id: "second",
				},
			],
		});
		assert.strictEqual(isAllowedWorkspaceUser(member), true);
	});

	test("users without a Slack identity pass only when allowed", () => {
		const emailUser = user({ identities: [] });
		assert.strictEqual(isAllowedWorkspaceUser(emailUser, false), false);
		assert.strictEqual(isAllowedWorkspaceUser(emailUser, true), true);
		// test/setup.ts pins the production rule.
		assert.strictEqual(allowsNonSlackUsers(), false);
		assert.strictEqual(isAllowedWorkspaceUser(user()), false);

		setAllowNonSlackUsers(true);
		assert.strictEqual(isAllowedWorkspaceUser(user()), true);
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
		assert.strictEqual(isLocalSupabase("", "test"), false);
	});
});
