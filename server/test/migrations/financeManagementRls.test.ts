import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

function localSupabaseEnvironment(): Record<string, string> {
	const output = execFileSync("supabase", ["status", "-o", "env"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return Object.fromEntries(
		output
			.split(/\r?\n/)
			.map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
			.filter((match): match is RegExpMatchArray => match !== null)
			.map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
	);
}

test("authenticated department users have scoped reads without direct writes", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const apiUrl = environment.API_URL;
	const anonKey = environment.ANON_KEY;
	const serviceRoleKey = environment.SERVICE_ROLE_KEY;
	assert.ok(apiUrl);
	assert.ok(anonKey);
	assert.ok(serviceRoleKey);

	const authOptions = {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	};
	const departmentClient = createClient(apiUrl, anonKey, authOptions);
	const serviceClient = createClient(apiUrl, serviceRoleKey, authOptions);
	const ownProjectId = randomUUID();
	const otherProjectId = randomUUID();

	const { data: previousPermission, error: permissionReadError } =
		await serviceClient
			.from("department_permissions")
			.select("permissions")
			.eq("department", "Makeathon")
			.maybeSingle();
	assert.ifError(permissionReadError);
	const previousPermissions = Array.isArray(previousPermission?.permissions)
		? previousPermission.permissions
		: [];

	try {
		const { error: permissionError } = await serviceClient
			.from("department_permissions")
			.upsert({
				department: "Makeathon",
				permissions: [
					...new Set([...previousPermissions, "finance.department"]),
				],
			});
		assert.ifError(permissionError);

		const { error: seedError } = await serviceClient
			.from("finance_projects")
			.insert([
				{
					id: ownProjectId,
					name: "RLS Makeathon project",
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
				},
				{
					id: otherProjectId,
					name: "RLS Community project",
					department: "Community",
					period_type: "year",
					period_key: "2026",
				},
			]);
		assert.ifError(seedError);

		const { error: signInError } =
			await departmentClient.auth.signInWithPassword({
				email: "makeathon-lead@example.com",
				password: "password123",
			});
		assert.ifError(signInError);

		const { data: visibleProjects, error: readError } = await departmentClient
			.from("finance_projects")
			.select("id, department")
			.in("id", [ownProjectId, otherProjectId]);
		assert.ifError(readError);
		assert.deepStrictEqual(visibleProjects, [
			{ id: ownProjectId, department: "Makeathon" },
		]);

		const { error: insertError } = await departmentClient
			.from("finance_projects")
			.insert({
				name: "Forbidden project",
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
			});
		assert.strictEqual(insertError?.code, "42501");

		const { error: updateError } = await departmentClient
			.from("finance_projects")
			.update({ name: "Forbidden update" })
			.eq("id", ownProjectId);
		assert.strictEqual(updateError?.code, "42501");

		for (const table of [
			"finance_projects",
			"finance_plan_items",
			"finance_plan_templates",
			"finance_plan_template_items",
			"finance_project_template_assignments",
			"finance_posting_allocations",
			"finance_reallocation_requests",
			"finance_reallocation_request_items",
			"finance_plan_item_posting_matches",
		]) {
			const { error: deleteError } = await departmentClient
				.from(table)
				.delete()
				.eq("id", ownProjectId);
			assert.strictEqual(
				deleteError?.code,
				"42501",
				`expected direct DELETE to be denied for ${table}`,
			);
		}
	} finally {
		await serviceClient
			.from("finance_projects")
			.delete()
			.in("id", [ownProjectId, otherProjectId]);
		if (previousPermission) {
			await serviceClient.from("department_permissions").upsert({
				department: "Makeathon",
				permissions: previousPermissions,
			});
		} else {
			await serviceClient
				.from("department_permissions")
				.delete()
				.eq("department", "Makeathon");
		}
		await departmentClient.auth.signOut();
	}
});

test("finance allocation and match RPCs serialize concurrent writes", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const serviceClient = createClient(
		environment.API_URL,
		environment.SERVICE_ROLE_KEY,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	const actor = "00000000-0000-0000-0000-000000000001";
	const allocationPostingId = `RLS-ALLOCATION-${randomUUID()}`;
	const postingCapacityId = `RLS-POSTING-${randomUUID()}`;
	const planPostingIds = [
		`RLS-PLAN-A-${randomUUID()}`,
		`RLS-PLAN-B-${randomUUID()}`,
	];
	const planItemIds = [randomUUID(), randomUUID(), randomUUID()];

	const replaceAllocations = (allocations: Array<Record<string, unknown>>) =>
		serviceClient.rpc("replace_finance_posting_allocations", {
			p_posting_external_id: allocationPostingId,
			p_allocations: allocations,
			p_actor: actor,
			p_posting_amount: -100,
		});
	const createMatch = (input: {
		planItemId: string;
		postingExternalId: string;
		amount: number;
		postingAmount: number;
		postingDirection?: "expense" | "income";
	}) =>
		serviceClient.rpc("create_finance_plan_item_posting_match", {
			p_id: randomUUID(),
			p_plan_item_id: input.planItemId,
			p_posting_external_id: input.postingExternalId,
			p_matched_amount: input.amount,
			p_match_type: "manual",
			p_actor: actor,
			p_posting_amount: input.postingAmount,
			p_posting_direction: input.postingDirection ?? "expense",
		});

	try {
		const { error: planItemError } = await serviceClient
			.from("finance_plan_items")
			.insert(
				planItemIds.map((id, index) => ({
					id,
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					label: `RLS plan item ${index}`,
					planned_amount: 100,
				})),
			);
		assert.ifError(planItemError);

		const { error: duplicateTargetError } = await replaceAllocations([
			{
				department: "Makeathon",
				project_id: null,
				tax_area: null,
				allocated_amount: -50,
				allocated_percentage: 50,
				note: null,
			},
			{
				department: "Makeathon",
				project_id: null,
				tax_area: null,
				allocated_amount: -50,
				allocated_percentage: 50,
				note: null,
			},
		]);
		assert.match(
			duplicateTargetError?.message ?? "",
			/allocation targets must be unique/i,
		);

		const allocationResults = await Promise.all([
			replaceAllocations([
				{
					department: "Makeathon",
					project_id: null,
					tax_area: null,
					allocated_amount: -100,
					allocated_percentage: 100,
					note: "complete",
				},
			]),
			replaceAllocations([
				{
					department: "Makeathon",
					project_id: null,
					tax_area: null,
					allocated_amount: -60,
					allocated_percentage: 60,
					note: "split",
				},
				{
					department: "Community",
					project_id: null,
					tax_area: null,
					allocated_amount: -40,
					allocated_percentage: 40,
					note: "split",
				},
			]),
		]);
		assert.ok(allocationResults.every((result) => result.error === null));

		const { data: finalAllocations, error: allocationReadError } =
			await serviceClient
				.from("finance_posting_allocations")
				.select("department, allocated_percentage, note")
				.eq("posting_external_id", allocationPostingId)
				.order("department");
		assert.ifError(allocationReadError);
		const finalAllocationShape = JSON.stringify(finalAllocations);
		assert.ok(
			finalAllocationShape ===
				JSON.stringify([
					{
						department: "Makeathon",
						allocated_percentage: 100,
						note: "complete",
					},
				]) ||
				finalAllocationShape ===
					JSON.stringify([
						{
							department: "Community",
							allocated_percentage: 40,
							note: "split",
						},
						{
							department: "Makeathon",
							allocated_percentage: 60,
							note: "split",
						},
					]),
		);

		const postingResults = await Promise.all([
			createMatch({
				planItemId: planItemIds[0],
				postingExternalId: postingCapacityId,
				amount: 60,
				postingAmount: -100,
			}),
			createMatch({
				planItemId: planItemIds[1],
				postingExternalId: postingCapacityId,
				amount: 60,
				postingAmount: -100,
			}),
		]);
		assert.strictEqual(
			postingResults.filter((result) => result.error === null).length,
			1,
		);
		assert.match(
			postingResults.find((result) => result.error)?.error?.message ?? "",
			/posting's available amount/i,
		);

		const planItemResults = await Promise.all(
			planPostingIds.map((postingExternalId) =>
				createMatch({
					planItemId: planItemIds[2],
					postingExternalId,
					amount: 60,
					postingAmount: -100,
				}),
			),
		);
		assert.strictEqual(
			planItemResults.filter((result) => result.error === null).length,
			1,
		);
		assert.match(
			planItemResults.find((result) => result.error)?.error?.message ?? "",
			/plan item's planned amount/i,
		);
	} finally {
		await serviceClient
			.from("finance_plan_item_posting_matches")
			.delete()
			.in("plan_item_id", planItemIds);
		await serviceClient
			.from("finance_posting_allocations")
			.delete()
			.eq("posting_external_id", allocationPostingId);
		await serviceClient
			.from("finance_plan_items")
			.delete()
			.in("id", planItemIds);
	}
});

test("finance project scope changes reject linked records", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const serviceClient = createClient(
		environment.API_URL,
		environment.SERVICE_ROLE_KEY,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	const parentProjectId = randomUUID();
	const childProjectId = randomUUID();
	const updateProject = (overrides: Record<string, unknown> = {}) =>
		serviceClient.rpc("update_finance_project", {
			p_id: parentProjectId,
			p_parent_project_id: null,
			p_name: "Protected parent",
			p_department: "Makeathon",
			p_period_type: "year",
			p_period_key: "2026",
			p_tax_area: "wirtschaftlich",
			p_target_amount: 0,
			p_status: "active",
			p_description: null,
			...overrides,
		});

	try {
		const { error: seedError } = await serviceClient
			.from("finance_projects")
			.insert([
				{
					id: parentProjectId,
					name: "Protected parent",
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					tax_area: "wirtschaftlich",
					status: "active",
				},
				{
					id: childProjectId,
					parent_project_id: parentProjectId,
					name: "Protected child",
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					tax_area: "wirtschaftlich",
					status: "active",
				},
			]);
		assert.ifError(seedError);

		const { error: departmentError } = await updateProject({
			p_department: "Community",
		});
		assert.match(
			departmentError?.message ?? "",
			/dependent finance records exist/i,
		);

		const { error: periodError } = await updateProject({
			p_period_key: "2027",
		});
		assert.match(
			periodError?.message ?? "",
			/dependent finance records exist/i,
		);

		const { data, error: nonStructuralError } = await updateProject({
			p_name: "Protected parent revised",
			p_tax_area: "ideell",
			p_target_amount: 1500,
		});
		assert.ifError(nonStructuralError);
		const updated = data as Record<string, unknown>;
		assert.strictEqual(updated.name, "Protected parent revised");
		assert.strictEqual(updated.department, "Makeathon");
		assert.strictEqual(updated.period_key, "2026");
		assert.strictEqual(updated.tax_area, "ideell");
	} finally {
		await serviceClient
			.from("finance_projects")
			.delete()
			.in("id", [childProjectId, parentProjectId]);
	}
});

test("finance project parent updates serialize cycle validation", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const serviceClient = createClient(
		environment.API_URL,
		environment.SERVICE_ROLE_KEY,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	const projectIds = [randomUUID(), randomUUID()];
	const updateParent = (projectId: string, parentProjectId: string) =>
		serviceClient.rpc("update_finance_project", {
			p_id: projectId,
			p_parent_project_id: parentProjectId,
			p_name: `Concurrent project ${projectId}`,
			p_department: "Makeathon",
			p_period_type: "year",
			p_period_key: "2026",
			p_tax_area: "wirtschaftlich",
			p_target_amount: 0,
			p_status: "active",
			p_description: null,
		});

	try {
		const { error: seedError } = await serviceClient
			.from("finance_projects")
			.insert(
				projectIds.map((id) => ({
					id,
					name: `Concurrent project ${id}`,
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					tax_area: "wirtschaftlich",
					status: "active",
				})),
			);
		assert.ifError(seedError);

		const results = await Promise.all([
			updateParent(projectIds[0], projectIds[1]),
			updateParent(projectIds[1], projectIds[0]),
		]);

		assert.strictEqual(
			results.filter((result) => result.error === null).length,
			1,
		);
		assert.match(
			results.find((result) => result.error)?.error?.message ?? "",
			/project hierarchy cannot contain a cycle/i,
		);

		const { data: projects, error: readError } = await serviceClient
			.from("finance_projects")
			.select("id, parent_project_id")
			.in("id", projectIds);
		assert.ifError(readError);
		assert.strictEqual(
			projects?.filter((project) => project.parent_project_id !== null).length,
			1,
		);
	} finally {
		await serviceClient.from("finance_projects").delete().in("id", projectIds);
	}
});

test("finance RPCs preserve scoped matches and reject stale mutations", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const serviceClient = createClient(
		environment.API_URL,
		environment.SERVICE_ROLE_KEY,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	const actor = "00000000-0000-0000-0000-000000000001";
	const splitPostingId = `RLS-SPLIT-${randomUUID()}`;
	const canonicalPostingId = `RLS-CANONICAL-${randomUUID()}`;
	const stalePostingId = `RLS-STALE-${randomUUID()}`;
	const planItemIds = [randomUUID(), randomUUID()];
	const requestIds: string[] = [];
	const allocation = (
		department: string,
		amount: number,
		percentage: number,
	) => ({
		department,
		project_id: null,
		tax_area: null,
		allocated_amount: amount,
		allocated_percentage: percentage,
		note: null,
	});
	const createMatch = (
		planItemId: string,
		amount: number,
		postingAmount: number,
	) =>
		serviceClient.rpc("create_finance_plan_item_posting_match", {
			p_id: randomUUID(),
			p_plan_item_id: planItemId,
			p_posting_external_id: splitPostingId,
			p_matched_amount: amount,
			p_match_type: "manual",
			p_actor: actor,
			p_posting_amount: postingAmount,
			p_posting_direction: "expense",
		});

	try {
		const { error: canonicalAllocationError } = await serviceClient.rpc(
			"replace_finance_posting_allocations",
			{
				p_posting_external_id: canonicalPostingId,
				p_allocations: [
					allocation("Makeathon", -50.01, 50),
					allocation("Community", -50, 50),
				],
				p_actor: actor,
				p_posting_amount: -100.01,
			},
		);
		assert.ifError(canonicalAllocationError);
		const { data: canonicalAllocations, error: canonicalReadError } =
			await serviceClient
				.from("finance_posting_allocations")
				.select("department, allocated_amount")
				.eq("posting_external_id", canonicalPostingId)
				.order("department", { ascending: true });
		assert.ifError(canonicalReadError);
		assert.deepStrictEqual(
			canonicalAllocations?.map((row) => ({
				department: row.department,
				allocated_amount: Number(row.allocated_amount),
			})),
			[
				{ department: "Community", allocated_amount: -50 },
				{ department: "Makeathon", allocated_amount: -50.01 },
			],
		);

		const { error: planItemError } = await serviceClient
			.from("finance_plan_items")
			.insert([
				{
					id: planItemIds[0],
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					label: "RLS Makeathon split",
					direction: "expense",
					planned_amount: 120,
				},
				{
					id: planItemIds[1],
					department: "Community",
					period_type: "year",
					period_key: "2026",
					label: "RLS Community split",
					direction: "expense",
					planned_amount: 80,
				},
			]);
		assert.ifError(planItemError);

		const { error: allocationError } = await serviceClient.rpc(
			"replace_finance_posting_allocations",
			{
				p_posting_external_id: splitPostingId,
				p_allocations: [
					allocation("Makeathon", -60, 60),
					allocation("Community", -40, 40),
				],
				p_actor: actor,
				p_posting_amount: -200,
			},
		);
		assert.ifError(allocationError);

		const { error: staleCapacityError } = await createMatch(
			planItemIds[0],
			121,
			-200,
		);
		assert.match(
			staleCapacityError?.message ?? "",
			/posting's available amount/i,
		);

		const scopedMatches = await Promise.all([
			createMatch(planItemIds[0], 120, -200),
			createMatch(planItemIds[1], 80, -200),
		]);
		assert.ok(scopedMatches.every((result) => result.error === null));

		const { error: invalidatingAllocationError } = await serviceClient.rpc(
			"replace_finance_posting_allocations",
			{
				p_posting_external_id: splitPostingId,
				p_allocations: [allocation("Makeathon", -100, 100)],
				p_actor: actor,
				p_posting_amount: -200,
			},
		);
		assert.match(
			invalidatingAllocationError?.message ?? "",
			/cannot invalidate existing plan item matches/i,
		);

		const { error: amountReductionError } = await serviceClient.rpc(
			"update_finance_plan_item",
			{
				p_id: planItemIds[0],
				p_label: "RLS Makeathon split",
				p_category: null,
				p_direction: "expense",
				p_planned_amount: 110,
				p_expected_month: null,
				p_status: "planned",
				p_note: null,
			},
		);
		assert.match(
			amountReductionError?.message ?? "",
			/cannot be reduced below its matched total/i,
		);

		const { error: directionChangeError } = await serviceClient.rpc(
			"update_finance_plan_item",
			{
				p_id: planItemIds[0],
				p_label: "RLS Makeathon split",
				p_category: null,
				p_direction: "income",
				p_planned_amount: 120,
				p_expected_month: null,
				p_status: "planned",
				p_note: null,
			},
		);
		assert.match(
			directionChangeError?.message ?? "",
			/direction cannot change while postings are matched/i,
		);

		const { error: staleSeedError } = await serviceClient.rpc(
			"replace_finance_posting_allocations",
			{
				p_posting_external_id: stalePostingId,
				p_allocations: [allocation("Makeathon", -100, 100)],
				p_actor: actor,
				p_posting_amount: -100,
			},
		);
		assert.ifError(staleSeedError);

		const { data: request, error: requestError } = await serviceClient.rpc(
			"create_finance_reallocation_request",
			{
				p_posting_external_id: stalePostingId,
				p_requesting_department: "Makeathon",
				p_reason: "RLS stale request",
				p_allocations: [allocation("Community", -100, 100)],
				p_actor: actor,
				p_posting_amount: -100,
			},
		);
		assert.ifError(requestError);
		const requestId = String(request.id);
		requestIds.push(requestId);

		const { error: duplicateRequestError } = await serviceClient.rpc(
			"create_finance_reallocation_request",
			{
				p_posting_external_id: stalePostingId,
				p_requesting_department: "Makeathon",
				p_reason: "RLS duplicate request",
				p_allocations: [allocation("Community", -100, 100)],
				p_actor: actor,
				p_posting_amount: -100,
			},
		);
		assert.match(
			duplicateRequestError?.message ?? "",
			/pending reallocation request already exists/i,
		);

		const { error: changedAllocationError } = await serviceClient.rpc(
			"replace_finance_posting_allocations",
			{
				p_posting_external_id: stalePostingId,
				p_allocations: [
					allocation("Makeathon", -60, 60),
					allocation("Community", -40, 40),
				],
				p_actor: actor,
				p_posting_amount: -100,
			},
		);
		assert.ifError(changedAllocationError);

		const { error: staleReviewError } = await serviceClient.rpc(
			"review_finance_reallocation_request",
			{
				p_request_id: requestId,
				p_decision: "approved",
				p_reviewer: actor,
				p_review_note: null,
				p_posting_amount: -100,
			},
		);
		assert.match(staleReviewError?.message ?? "", /request is stale/i);
	} finally {
		await serviceClient
			.from("finance_plan_item_posting_matches")
			.delete()
			.in("plan_item_id", planItemIds);
		if (requestIds.length > 0) {
			await serviceClient
				.from("finance_reallocation_requests")
				.delete()
				.in("id", requestIds);
		}
		await serviceClient
			.from("finance_posting_allocations")
			.delete()
			.in("posting_external_id", [
				splitPostingId,
				canonicalPostingId,
				stalePostingId,
			]);
		await serviceClient
			.from("finance_plan_items")
			.delete()
			.in("id", planItemIds);
	}
});
