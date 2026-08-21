import type { ContractRenderableBlock } from "@member-manager/shared";
import { DatabaseError } from "../errors.js";
import { getSupabase } from "../supabase.js";

function isMissingContractsTable(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const candidate = error as { code?: unknown; message?: unknown };
	const message =
		typeof candidate.message === "string"
			? candidate.message.toLowerCase()
			: "";
	return (
		candidate.code === "42P01" ||
		candidate.code === "PGRST205" ||
		(message.includes("contract_") && message.includes("not exist")) ||
		(message.includes("contract_") && message.includes("not found"))
	);
}

export function createContractDatabaseError(error: unknown): DatabaseError {
	if (isMissingContractsTable(error)) {
		return new DatabaseError(
			"Contracts tables are missing locally. Run `pnpm supabase:reset` to apply migrations.",
		);
	}
	return new DatabaseError();
}

export async function fetchTemplateWithChildren(templateId: string) {
	const supabase = getSupabase();
	const [templateResult, variablesResult, blocksResult, documentsResult] =
		await Promise.all([
			supabase
				.from("contract_templates")
				.select(
					"id, name, description, renderer_engine, active_document_id, is_active, created_at, updated_at",
				)
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
			supabase
				.from("contract_template_documents")
				.select("*")
				.eq("template_id", templateId)
				.order("version", { ascending: false }),
		]);

	if (templateResult.error) throw templateResult.error;
	if (variablesResult.error) throw variablesResult.error;
	if (blocksResult.error) throw blocksResult.error;
	if (documentsResult.error) throw documentsResult.error;

	return {
		template: templateResult.data,
		variables: variablesResult.data ?? [],
		blocks: (blocksResult.data ?? []) as ContractRenderableBlock[],
		documents: documentsResult.data ?? [],
	};
}

export async function fetchDocumentVersion(
	versionId: unknown,
): Promise<Record<string, unknown> | null> {
	if (typeof versionId !== "string" || !versionId) return null;
	const { data, error } = await getSupabase()
		.from("contract_document_versions")
		.select("*")
		.eq("id", versionId)
		.maybeSingle();
	if (error) throw error;
	return (data as Record<string, unknown> | null) ?? null;
}

export async function fetchSubmissionComments(
	submissionId: string,
): Promise<Array<Record<string, unknown>>> {
	const { data, error } = await getSupabase()
		.from("contract_partner_comments")
		.select(
			"id, submission_id, author_type, author_name, author_email, comment, document_version_id, created_at",
		)
		.eq("submission_id", submissionId)
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data ?? []) as Array<Record<string, unknown>>;
}

export async function createSubmissionComment(args: {
	submissionId: string;
	authorType: "partner" | "internal";
	authorName?: string | null;
	authorEmail?: string | null;
	comment: string;
	documentVersionId?: string | null;
	createdBy?: string | null;
}): Promise<Record<string, unknown>> {
	const { data, error } = await getSupabase()
		.from("contract_partner_comments")
		.insert({
			submission_id: args.submissionId,
			author_type: args.authorType,
			author_name: args.authorName ?? null,
			author_email: args.authorEmail ?? null,
			comment: args.comment,
			document_version_id: args.documentVersionId ?? null,
			created_by: args.createdBy ?? null,
		})
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}
