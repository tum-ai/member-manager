import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DatabaseError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireLegalFinance } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

// =========================================================================
// Types & schemas
// =========================================================================

const DATA_TYPES = [
	"TEXT",
	"TEXTAREA",
	"NUMBER",
	"DATE",
	"BOOLEAN",
	"SELECT",
	"FILE",
] as const;

const CONDITION_TYPES = ["ALWAYS", "IF_YES", "IF_NO", "IF_VALUE"] as const;

const SUBMISSION_STATUSES = [
	"draft",
	"submitted",
	"in_review",
	"approved",
	"rejected",
	"inquiry",
	"signed",
	"completed",
] as const;

type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

const TemplateBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000).nullable().optional(),
	contract_text: z.string().max(200_000).default(""),
	is_active: z.boolean().optional().default(true),
});

const VariableBodySchema = z.object({
	variable_name: z
		.string()
		.trim()
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_]*$/,
			"Variable name must be alphanumeric/underscore",
		)
		.max(80),
	label: z.string().trim().min(1).max(200),
	data_type: z.enum(DATA_TYPES).default("TEXT"),
	help_text: z.string().trim().max(1000).nullable().optional(),
	options: z.unknown().nullable().optional(),
	is_required: z.boolean().optional().default(false),
	is_multiselect: z.boolean().optional().default(false),
	show_if_variable: z.string().trim().max(80).nullable().optional(),
	show_if_value: z.string().trim().max(200).nullable().optional(),
	sort_order: z.number().int().min(0).max(10_000).optional().default(0),
});

const ConditionalBlockBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	condition_type: z.enum(CONDITION_TYPES).default("ALWAYS"),
	condition_variable: z.string().trim().max(80).nullable().optional(),
	condition_value: z.string().trim().max(500).nullable().optional(),
	block_text: z.string().max(50_000).default(""),
	sort_order: z.number().int().min(0).max(10_000).optional().default(0),
});

const SubmissionBodySchema = z.object({
	template_id: z.string().uuid(),
	form_data: z.record(z.string(), z.unknown()),
	status: z.enum(["draft", "submitted"]).optional().default("submitted"),
});

const SubmissionPatchSchema = z
	.object({
		status: z.enum(SUBMISSION_STATUSES).optional(),
		admin_edited_text: z.string().max(200_000).nullable().optional(),
		notes: z.string().max(5000).nullable().optional(),
		feedback_message: z.string().max(5000).nullable().optional(),
		generate_signature_token: z.boolean().optional(),
		signature_token_ttl_hours: z.number().int().min(1).max(720).optional(),
	})
	.refine(
		(value) =>
			value.status !== undefined ||
			value.admin_edited_text !== undefined ||
			value.notes !== undefined ||
			value.feedback_message !== undefined ||
			value.generate_signature_token === true,
		{ message: "No-op patch" },
	);

const SignBodySchema = z.object({
	signature_data: z.string().min(1).max(2_000_000),
	signer_name: z.string().trim().min(1).max(200),
});

// =========================================================================
// Contract text renderer (ported & simplified from contract-generator)
// Supports: {{variable}} substitution, [IF {{var}} OP "value" THEN {..}
// ELSE {..}] inline conditionals, and appending DB conditional blocks.
// German keywords are still accepted for templates ported from the old tool.
// =========================================================================

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const CONDITIONAL_REGEX =
	/\[(?:WENN|IF)\s+\{\{([a-zA-Z0-9_]+)\}\}\s*(=|!=|enthält|contains)\s*"([^"]*)"\s+(?:DANN|THEN)\s+\{((?:[^{}]|\{\{[^}]*\}\})*)\}(?:\s+(?:SONST|ELSE)\s+\{((?:[^{}]|\{\{[^}]*\}\})*)\})?\]/gi;

function stringifyVariable(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (Array.isArray(value)) return value.map(stringifyVariable).join(", ");
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function evaluateCondition(
	rawValue: unknown,
	operator: string,
	expected: string,
): boolean {
	const actual = stringifyVariable(rawValue).trim();
	const target = expected.trim();
	switch (operator.toLowerCase()) {
		case "=":
			return actual === target;
		case "!=":
			return actual !== target;
		case "enthält":
		case "contains":
			return actual.toLowerCase().includes(target.toLowerCase());
		default:
			return false;
	}
}

function applyInlineConditionals(
	text: string,
	formData: Record<string, unknown>,
): string {
	return text.replace(
		CONDITIONAL_REGEX,
		(_full, variable, op, expected, thenText, elseText) => {
			const matched = evaluateCondition(formData[variable], op, expected);
			return matched ? thenText : (elseText ?? "");
		},
	);
}

function substituteVariables(
	text: string,
	formData: Record<string, unknown>,
): string {
	return text.replace(VARIABLE_REGEX, (_full, name) =>
		stringifyVariable(formData[name]),
	);
}

interface ConditionalBlockRow {
	condition_type: (typeof CONDITION_TYPES)[number];
	condition_variable: string | null;
	condition_value: string | null;
	block_text: string;
	sort_order: number;
}

function blockMatches(
	block: ConditionalBlockRow,
	formData: Record<string, unknown>,
): boolean {
	if (block.condition_type === "ALWAYS") return true;
	const variable = block.condition_variable;
	if (!variable) return false;
	const raw = formData[variable];
	const asString = stringifyVariable(raw).trim();
	const normalized = asString.toLowerCase();
	switch (block.condition_type) {
		case "IF_YES":
			return (
				raw === true ||
				normalized === "yes" ||
				normalized === "ja" ||
				normalized === "true"
			);
		case "IF_NO":
			return (
				raw === false ||
				normalized === "no" ||
				normalized === "nein" ||
				normalized === "false" ||
				asString === ""
			);
		case "IF_VALUE":
			return asString === (block.condition_value ?? "").trim();
		default:
			return false;
	}
}

export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ConditionalBlockRow[],
): string {
	const matchingBlocks = blocks
		.filter((block) => blockMatches(block, formData))
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((block) => block.block_text)
		.filter((text) => text.trim().length > 0);

	const combined =
		matchingBlocks.length > 0
			? `${contractText}\n\n${matchingBlocks.join("\n\n")}`
			: contractText;

	const afterConditionals = applyInlineConditionals(combined, formData);
	return substituteVariables(afterConditionals, formData);
}

// =========================================================================
// Helpers
// =========================================================================

function generateSignatureToken(): string {
	return randomBytes(32).toString("hex");
}

function isMissingContractsTable(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const e = error as { code?: unknown; message?: unknown };
	const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
	return (
		e.code === "42P01" ||
		e.code === "PGRST205" ||
		(message.includes("contract_") && message.includes("not exist")) ||
		(message.includes("contract_") && message.includes("not found"))
	);
}

function createContractDatabaseError(error: unknown): DatabaseError {
	if (isMissingContractsTable(error)) {
		return new DatabaseError(
			"Contracts tables are missing locally. Run `pnpm supabase:reset` to apply migrations.",
		);
	}
	return new DatabaseError();
}

async function fetchTemplateWithChildren(templateId: string) {
	const supabase = getSupabase();
	const [tplRes, varsRes, blocksRes] = await Promise.all([
		supabase
			.from("contract_templates")
			.select("*")
			.eq("id", templateId)
			.single(),
		supabase
			.from("contract_template_variables")
			.select("*")
			.eq("template_id", templateId)
			.order("sort_order", { ascending: true }),
		supabase
			.from("contract_conditional_blocks")
			.select("*")
			.eq("template_id", templateId)
			.order("sort_order", { ascending: true }),
	]);

	if (tplRes.error) throw tplRes.error;
	if (varsRes.error) throw varsRes.error;
	if (blocksRes.error) throw blocksRes.error;

	return {
		template: tplRes.data,
		variables: varsRes.data ?? [],
		blocks: (blocksRes.data ?? []) as ConditionalBlockRow[],
	};
}

// =========================================================================
// Route plugin
// =========================================================================

export async function contractRoutes(server: FastifyInstance) {
	// ---------------------------------------------------------------------
	// Templates: list/get for any authenticated user; mutate for L&F only.
	// ---------------------------------------------------------------------

	server.get(
		"/contracts/templates",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("contract_templates")
				.select("*")
				.order("name", { ascending: true });

			if (error) {
				request.log.error({ err: error }, "Failed to list contract templates");
				throw createContractDatabaseError(error);
			}

			return data ?? [];
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/templates/:id",
		{ preHandler: authenticate },
		async (request, reply) => {
			try {
				const result = await fetchTemplateWithChildren(request.params.id);
				return result;
			} catch (error) {
				const code = (error as { code?: string } | null)?.code;
				if (code === "PGRST116") {
					return reply.status(404).send({ error: "Template not found" });
				}
				request.log.error({ err: error }, "Failed to fetch template");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.post(
		"/contracts/templates",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, _reply) => {
			const body = TemplateBodySchema.parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_templates")
				.insert(body)
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create template");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/templates/:id",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const body = TemplateBodySchema.partial().parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_templates")
				.update({ ...body, updated_at: new Date().toISOString() })
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Template not found" });
				}
				request.log.error({ err: error }, "Failed to update template");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.delete<{ Params: { id: string } }>(
		"/contracts/templates/:id",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const { count, error } = await getSupabase()
				.from("contract_templates")
				.delete({ count: "exact" })
				.eq("id", request.params.id);
			if (error) {
				if ((error as { code?: string }).code === "23503") {
					return reply
						.status(409)
						.send({ error: "Cannot delete a template that has submissions." });
				}
				request.log.error({ err: error }, "Failed to delete template");
				throw createContractDatabaseError(error);
			}
			if (!count || count === 0) {
				return reply.status(404).send({ error: "Template not found" });
			}
			return reply.status(204).send();
		},
	);

	// ---------------------------------------------------------------------
	// Variables (nested under template) — L&F only.
	// ---------------------------------------------------------------------

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/variables",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, _reply) => {
			const body = VariableBodySchema.parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_template_variables")
				.insert({ ...body, template_id: request.params.id })
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create variable");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string; variableId: string } }>(
		"/contracts/templates/:id/variables/:variableId",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const body = VariableBodySchema.partial().parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_template_variables")
				.update({ ...body, updated_at: new Date().toISOString() })
				.eq("id", request.params.variableId)
				.eq("template_id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Variable not found" });
				}
				request.log.error({ err: error }, "Failed to update variable");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.delete<{ Params: { id: string; variableId: string } }>(
		"/contracts/templates/:id/variables/:variableId",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const { error } = await getSupabase()
				.from("contract_template_variables")
				.delete()
				.eq("id", request.params.variableId)
				.eq("template_id", request.params.id);
			if (error) {
				request.log.error({ err: error }, "Failed to delete variable");
				throw createContractDatabaseError(error);
			}
			return reply.status(204).send();
		},
	);

	// ---------------------------------------------------------------------
	// Conditional blocks (nested under template) — L&F only.
	// ---------------------------------------------------------------------

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/blocks",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, _reply) => {
			const body = ConditionalBlockBodySchema.parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_conditional_blocks")
				.insert({ ...body, template_id: request.params.id })
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create conditional block");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string; blockId: string } }>(
		"/contracts/templates/:id/blocks/:blockId",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const body = ConditionalBlockBodySchema.partial().parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_conditional_blocks")
				.update({ ...body, updated_at: new Date().toISOString() })
				.eq("id", request.params.blockId)
				.eq("template_id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Block not found" });
				}
				request.log.error({ err: error }, "Failed to update block");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.delete<{ Params: { id: string; blockId: string } }>(
		"/contracts/templates/:id/blocks/:blockId",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const { error } = await getSupabase()
				.from("contract_conditional_blocks")
				.delete()
				.eq("id", request.params.blockId)
				.eq("template_id", request.params.id);
			if (error) {
				request.log.error({ err: error }, "Failed to delete block");
				throw createContractDatabaseError(error);
			}
			return reply.status(204).send();
		},
	);

	// ---------------------------------------------------------------------
	// Submissions: list/own for users, list-all for L&F, create for anyone,
	// patch (review/approve/sign-link) for L&F.
	// ---------------------------------------------------------------------

	server.get(
		"/contracts/submissions",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;
			// RLS already enforces visibility: L&F see all, users see own.
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, template_id, submitter_user_id, status, submitted_at, signed_at, created_at, updated_at, signature_token, signature_token_expires_at",
				)
				.order("created_at", { ascending: false });
			if (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to list submissions",
				);
				throw createContractDatabaseError(error);
			}
			return data ?? [];
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to fetch submission");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.post(
		"/contracts/submissions",
		{ preHandler: authenticate },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SubmissionBodySchema.parse(request.body);

			let rendered: string;
			try {
				const { template, blocks } = await fetchTemplateWithChildren(
					body.template_id,
				);
				if (!template) {
					return reply.status(404).send({ error: "Template not found" });
				}
				rendered = renderContractText(
					(template as { contract_text: string }).contract_text,
					body.form_data,
					blocks,
				);
			} catch (error) {
				request.log.error({ err: error }, "Failed to render contract text");
				throw createContractDatabaseError(error);
			}

			const now = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.insert({
					template_id: body.template_id,
					submitter_user_id: user.id,
					form_data: body.form_data,
					generated_contract_text: rendered,
					status: body.status,
					submitted_at: now,
				})
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create submission");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/submissions/:id",
		{ preHandler: [authenticate, requireLegalFinance] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SubmissionPatchSchema.parse(request.body);

			const update: Record<string, unknown> = {
				updated_at: new Date().toISOString(),
				reviewed_by: user.id,
				reviewed_at: new Date().toISOString(),
			};
			if (body.status !== undefined)
				update.status = body.status satisfies SubmissionStatus;
			if (body.admin_edited_text !== undefined)
				update.admin_edited_text = body.admin_edited_text;
			if (body.notes !== undefined) update.notes = body.notes;
			if (body.feedback_message !== undefined)
				update.feedback_message = body.feedback_message;
			if (body.generate_signature_token === true) {
				const ttlHours = body.signature_token_ttl_hours ?? 24 * 30;
				update.signature_token = generateSignatureToken();
				update.signature_token_expires_at = new Date(
					Date.now() + ttlHours * 60 * 60 * 1000,
				).toISOString();
			}

			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update(update)
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to update submission");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	// ---------------------------------------------------------------------
	// Public signing endpoints (no auth). Verified by signature_token only.
	// ---------------------------------------------------------------------

	server.get<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, admin_edited_text, generated_contract_text, signature_token_expires_at, signed_at",
				)
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (error) {
				request.log.error({ err: error }, "Failed to fetch signing payload");
				throw createContractDatabaseError(error);
			}
			if (!data) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				data.signature_token_expires_at &&
				new Date(data.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (data.signed_at) {
				return reply.status(409).send({ error: "Contract already signed" });
			}

			return {
				contract_text:
					data.admin_edited_text ?? data.generated_contract_text ?? "",
				status: data.status,
			};
		},
	);

	server.post<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const body = SignBodySchema.parse(request.body);

			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status, signature_token_expires_at, signed_at")
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (fetchError) {
				request.log.error(
					{ err: fetchError },
					"Failed to load submission for sign",
				);
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				submission.signature_token_expires_at &&
				new Date(submission.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (submission.signed_at) {
				return reply.status(409).send({ error: "Contract already signed" });
			}

			const nowIso = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					signature_data: body.signature_data,
					signer_name: body.signer_name,
					signed_at: nowIso,
					status: "signed",
					signature_token: null,
					updated_at: nowIso,
				})
				.eq("id", submission.id)
				.select("id, status, signed_at")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record signature");
				throw createContractDatabaseError(error);
			}

			// TODO(contract-mvp): emit fire-and-forget PDF + email to submitter.
			// Handled in a later iteration; see plan task #5.
			return data;
		},
	);
}

// Re-export for tests
export const __testing = {
	renderContractText,
	stringifyVariable,
	evaluateCondition,
	blockMatches,
};
