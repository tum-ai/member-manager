import { randomUUID } from "node:crypto";
import {
	type FinanceManagedPlanItem,
	FinanceManagedPlanItemSchema,
	type FinancePeriodType,
	type FinancePlanTemplate,
	FinancePlanTemplateAssignmentResponseSchema,
	type FinancePlanTemplateCreate,
	type FinancePlanTemplateItem,
	type FinancePlanTemplateItemCreate,
	type FinancePlanTemplateItemUpdate,
	FinancePlanTemplateSchema,
	type FinancePlanTemplateUpdate,
	type FinanceProject,
	type FinanceProjectCreate,
	FinanceProjectSchema,
	type FinanceProjectsQuery,
} from "@member-manager/shared";
import {
	ConflictError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "./errors.js";
import { getSupabase } from "./supabase.js";

const PROJECT_COLUMNS =
	"id, parent_project_id, name, department, period_type, period_key, tax_area, target_amount, status, description, created_at, updated_at";
const TEMPLATE_COLUMNS =
	"id, name, description, tax_area, is_active, created_at, updated_at";
const TEMPLATE_ITEM_COLUMNS =
	"id, template_id, label, category, direction, planned_amount, expected_month, note, sort_order";
const MANAGED_PLAN_ITEM_COLUMNS =
	"id, department, period_type, period_key, label, category, direction, planned_amount, expected_month, status, note, project_id, template_item_id";

function parseProject(row: Record<string, unknown>): FinanceProject {
	return FinanceProjectSchema.parse({
		...row,
		target_amount: Number(row.target_amount ?? 0),
	});
}

function parseTemplateItem(
	row: Record<string, unknown>,
): FinancePlanTemplateItem {
	return {
		id: String(row.id),
		template_id: String(row.template_id),
		label: String(row.label),
		category: (row.category ?? null) as string | null,
		direction: row.direction === "income" ? "income" : "expense",
		planned_amount: Number(row.planned_amount ?? 0),
		expected_month: (row.expected_month ?? null) as string | null,
		note: (row.note ?? null) as string | null,
		sort_order: Number(row.sort_order ?? 0),
	};
}

function parseManagedPlanItem(
	row: Record<string, unknown>,
): FinanceManagedPlanItem {
	return FinanceManagedPlanItemSchema.parse({
		...row,
		planned_amount: Number(row.planned_amount ?? 0),
		direction: row.direction === "income" ? "income" : "expense",
		project_id: row.project_id ?? null,
		template_item_id: row.template_item_id ?? null,
	});
}

export async function listFinanceProjects(
	query: FinanceProjectsQuery,
	department: string | null,
): Promise<FinanceProject[]> {
	let request = getSupabase().from("finance_projects").select(PROJECT_COLUMNS);

	if (department !== null) {
		request = request.eq("department", department);
	}
	if (query.period_type) {
		request = request.eq("period_type", query.period_type);
	}
	if (query.period_key) {
		request = request.eq("period_key", query.period_key);
	}
	if (query.status) {
		request = request.eq("status", query.status);
	}

	const { data, error } = await request.order("name", { ascending: true });
	if (error) {
		throw new DatabaseError("Failed to load finance projects");
	}

	return (data ?? []).map(parseProject);
}

export async function getFinanceProject(
	projectId: string,
): Promise<FinanceProject | null> {
	const { data, error } = await getSupabase()
		.from("finance_projects")
		.select(PROJECT_COLUMNS)
		.eq("id", projectId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to load finance project");
	}
	return data ? parseProject(data) : null;
}

export async function createFinanceProject(
	input: FinanceProjectCreate,
	createdBy: string,
): Promise<FinanceProject> {
	const now = new Date().toISOString();
	const { data, error } = await getSupabase()
		.from("finance_projects")
		.insert({
			id: randomUUID(),
			parent_project_id: input.parent_project_id ?? null,
			name: input.name,
			department: input.department,
			period_type: input.period_type,
			period_key: input.period_key,
			tax_area: input.tax_area ?? null,
			target_amount: input.target_amount,
			status: input.status ?? "draft",
			description: input.description ?? null,
			created_by: createdBy,
			created_at: now,
			updated_at: now,
		})
		.select(PROJECT_COLUMNS)
		.single();

	if (error) {
		throw new DatabaseError("Failed to create finance project");
	}
	return parseProject(data);
}

export async function updateFinanceProject(
	projectId: string,
	input: FinanceProjectCreate,
): Promise<FinanceProject> {
	const { data, error } = await getSupabase().rpc("update_finance_project", {
		p_id: projectId,
		p_parent_project_id: input.parent_project_id ?? null,
		p_name: input.name,
		p_department: input.department,
		p_period_type: input.period_type,
		p_period_key: input.period_key,
		p_tax_area: input.tax_area ?? null,
		p_target_amount: input.target_amount,
		p_status: input.status ?? "draft",
		p_description: input.description ?? null,
	});

	if (error) {
		const message = error.message;
		if (message.includes("Parent finance project not found")) {
			throw new NotFoundError("Parent finance project not found");
		}
		if (message.includes("not found")) {
			throw new NotFoundError("Finance project not found");
		}
		if (message.includes("dependent finance records")) {
			throw new ConflictError(message);
		}
		if (message.includes("Project hierarchy cannot contain a cycle")) {
			throw new ConflictError(message);
		}
		if (
			message.includes("Parent project must use the same department and period")
		) {
			throw new ValidationError(message);
		}
		throw new DatabaseError("Failed to update finance project");
	}
	return parseProject(data);
}

export function wouldCreateFinanceProjectCycle(
	projectId: string,
	parentProjectId: string | null,
	projects: FinanceProject[],
): boolean {
	let current = parentProjectId;
	const parents = new Map(
		projects.map((project) => [project.id, project.parent_project_id]),
	);
	const visited = new Set<string>();

	while (current) {
		if (current === projectId || visited.has(current)) {
			return true;
		}
		visited.add(current);
		current = parents.get(current) ?? null;
	}
	return false;
}

export async function listFinancePlanTemplates(): Promise<
	FinancePlanTemplate[]
> {
	const [{ data: templates, error: templatesError }, { data: items, error }] =
		await Promise.all([
			getSupabase()
				.from("finance_plan_templates")
				.select(TEMPLATE_COLUMNS)
				.order("name", { ascending: true }),
			getSupabase()
				.from("finance_plan_template_items")
				.select(TEMPLATE_ITEM_COLUMNS)
				.order("sort_order", { ascending: true }),
		]);

	if (templatesError || error) {
		throw new DatabaseError("Failed to load finance plan templates");
	}

	const itemsByTemplate = new Map<string, FinancePlanTemplateItem[]>();
	for (const row of items ?? []) {
		const item = parseTemplateItem(row);
		const current = itemsByTemplate.get(item.template_id) ?? [];
		current.push(item);
		itemsByTemplate.set(item.template_id, current);
	}

	return (templates ?? []).map((row) =>
		FinancePlanTemplateSchema.parse({
			...row,
			items: itemsByTemplate.get(String(row.id)) ?? [],
		}),
	);
}

export async function getFinancePlanTemplate(
	templateId: string,
): Promise<FinancePlanTemplate | null> {
	const templates = await listFinancePlanTemplates();
	return templates.find((template) => template.id === templateId) ?? null;
}

export async function createFinancePlanTemplate(
	input: FinancePlanTemplateCreate,
	createdBy: string,
): Promise<FinancePlanTemplate> {
	const now = new Date().toISOString();
	const { data, error } = await getSupabase()
		.from("finance_plan_templates")
		.insert({
			id: randomUUID(),
			name: input.name,
			description: input.description ?? null,
			tax_area: input.tax_area ?? null,
			is_active: input.is_active ?? true,
			created_by: createdBy,
			created_at: now,
			updated_at: now,
		})
		.select(TEMPLATE_COLUMNS)
		.single();

	if (error) {
		throw new DatabaseError("Failed to create finance plan template");
	}
	return FinancePlanTemplateSchema.parse({ ...data, items: [] });
}

export async function updateFinancePlanTemplate(
	templateId: string,
	input: FinancePlanTemplateUpdate,
): Promise<FinancePlanTemplate> {
	const { data, error } = await getSupabase()
		.from("finance_plan_templates")
		.update({ ...input, updated_at: new Date().toISOString() })
		.eq("id", templateId)
		.select(TEMPLATE_COLUMNS)
		.single();

	if (error) {
		throw new DatabaseError("Failed to update finance plan template");
	}

	const items = (await listFinancePlanTemplates()).find(
		(template) => template.id === templateId,
	)?.items;
	return FinancePlanTemplateSchema.parse({ ...data, items: items ?? [] });
}

export async function createFinancePlanTemplateItem(
	templateId: string,
	input: FinancePlanTemplateItemCreate,
): Promise<FinancePlanTemplateItem> {
	const { data, error } = await getSupabase()
		.from("finance_plan_template_items")
		.insert({
			id: randomUUID(),
			template_id: templateId,
			label: input.label,
			category: input.category ?? null,
			direction: input.direction ?? "expense",
			planned_amount: input.planned_amount,
			expected_month: input.expected_month ?? null,
			note: input.note ?? null,
			sort_order: input.sort_order ?? 0,
			updated_at: new Date().toISOString(),
		})
		.select(TEMPLATE_ITEM_COLUMNS)
		.single();

	if (error) {
		throw new DatabaseError("Failed to create finance plan template item");
	}
	return parseTemplateItem(data);
}

export async function updateFinancePlanTemplateItem(
	itemId: string,
	input: FinancePlanTemplateItemUpdate,
): Promise<FinancePlanTemplateItem> {
	const { data, error } = await getSupabase()
		.from("finance_plan_template_items")
		.update({ ...input, updated_at: new Date().toISOString() })
		.eq("id", itemId)
		.select(TEMPLATE_ITEM_COLUMNS)
		.single();

	if (error) {
		throw new DatabaseError("Failed to update finance plan template item");
	}
	return parseTemplateItem(data);
}

export async function deleteFinancePlanTemplateItem(
	itemId: string,
): Promise<void> {
	const { error } = await getSupabase()
		.from("finance_plan_template_items")
		.delete()
		.eq("id", itemId);

	if (error) {
		throw new DatabaseError("Failed to delete finance plan template item");
	}
}

export async function assignFinancePlanTemplate(
	projectId: string,
	templateId: string,
	actor: string,
) {
	const { data, error } = await getSupabase().rpc(
		"assign_finance_plan_template",
		{
			p_project_id: projectId,
			p_template_id: templateId,
			p_actor: actor,
		},
	);

	if (error) {
		throw new DatabaseError("Failed to assign finance plan template");
	}
	return FinancePlanTemplateAssignmentResponseSchema.parse(data);
}

export async function loadManagedPlanItems(
	periodType: FinancePeriodType,
	periodKey: string,
	department: string | null,
	projectId?: string,
): Promise<FinanceManagedPlanItem[]> {
	let query = getSupabase()
		.from("finance_plan_items")
		.select(MANAGED_PLAN_ITEM_COLUMNS)
		.eq("period_type", periodType)
		.eq("period_key", periodKey);

	if (department !== null) {
		query = query.eq("department", department);
	}
	if (projectId) {
		query = query.eq("project_id", projectId);
	}

	const { data, error } = await query.order("label", { ascending: true });
	if (error) {
		throw new DatabaseError("Failed to load finance plan items");
	}
	return (data ?? []).map(parseManagedPlanItem);
}

export async function getManagedPlanItem(
	itemId: string,
): Promise<FinanceManagedPlanItem | null> {
	const { data, error } = await getSupabase()
		.from("finance_plan_items")
		.select(MANAGED_PLAN_ITEM_COLUMNS)
		.eq("id", itemId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to load finance plan item");
	}
	return data ? parseManagedPlanItem(data) : null;
}
