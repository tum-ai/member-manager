import {
	ConditionalBlockBodySchema,
	enrichContractFormData,
	PreviewBodySchema,
	TemplateBodySchema,
	VariableBodySchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { renderContractDocument } from "../../lib/contracts/contractDocument.js";
import {
	createContractDatabaseError,
	fetchTemplateWithChildren,
} from "../../lib/contracts/contractRepository.js";
import { getSupabase } from "../../lib/supabase.js";
import {
	authenticate,
	requireContractsAdmin,
	requireContractsCreate,
} from "../../middleware/auth.js";

export async function contractTemplateRoutes(server: FastifyInstance) {
	// ---------------------------------------------------------------------
	// Template reads are available to contract creators; mutations require
	// contracts.admin.
	// ---------------------------------------------------------------------

	server.get(
		"/contracts/templates",
		{ preHandler: [authenticate, requireContractsCreate] },
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
		{ preHandler: [authenticate, requireContractsCreate] },
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

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/preview",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const body = PreviewBodySchema.parse(request.body);
			const formData = enrichContractFormData(body.form_data);
			try {
				const { template, blocks } = await fetchTemplateWithChildren(
					request.params.id,
				);
				if (!template) {
					return reply.status(404).send({ error: "Template not found" });
				}
				return renderContractDocument(
					(template as { contract_text: string }).contract_text,
					formData,
					blocks,
				);
			} catch (error) {
				const code = (error as { code?: string } | null)?.code;
				if (code === "PGRST116") {
					return reply.status(404).send({ error: "Template not found" });
				}
				request.log.error({ err: error }, "Failed to render contract preview");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.post(
		"/contracts/templates",
		{ preHandler: [authenticate, requireContractsAdmin] },
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
		{ preHandler: [authenticate, requireContractsAdmin] },
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
		{ preHandler: [authenticate, requireContractsAdmin] },
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
	// Variables (nested under template) — contracts admins only.
	// ---------------------------------------------------------------------

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/variables",
		{ preHandler: [authenticate, requireContractsAdmin] },
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
		{ preHandler: [authenticate, requireContractsAdmin] },
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
		{ preHandler: [authenticate, requireContractsAdmin] },
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
	// Conditional blocks (nested under template) — contracts admins only.
	// ---------------------------------------------------------------------

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/blocks",
		{ preHandler: [authenticate, requireContractsAdmin] },
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
		{ preHandler: [authenticate, requireContractsAdmin] },
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
		{ preHandler: [authenticate, requireContractsAdmin] },
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
}
