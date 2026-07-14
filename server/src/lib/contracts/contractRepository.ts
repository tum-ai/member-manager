import type { ContractRenderableBlock } from "@member-manager/shared";
import { DatabaseError } from "../errors.js";
import { getSupabase } from "../supabase.js";
import { renderDocumentPages } from "./contractDocument.js";

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
	const [templateResult, variablesResult, blocksResult] = await Promise.all([
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

	if (templateResult.error) throw templateResult.error;
	if (variablesResult.error) throw variablesResult.error;
	if (blocksResult.error) throw blocksResult.error;

	return {
		template: templateResult.data,
		variables: variablesResult.data ?? [],
		blocks: (blocksResult.data ?? []) as ContractRenderableBlock[],
	};
}

export async function createDocumentVersion(args: {
	submissionId: string;
	source: string;
	text: string;
	formData: Record<string, unknown>;
	createdBy?: string | null;
}): Promise<Record<string, unknown>> {
	const supabase = getSupabase();
	const { data: latest, error: latestError } = await supabase
		.from("contract_document_versions")
		.select("version_number")
		.eq("submission_id", args.submissionId)
		.order("version_number", { ascending: false })
		.limit(1);
	if (latestError) throw latestError;

	const latestVersion = Array.isArray(latest)
		? Number(
				(latest[0] as { version_number?: unknown } | undefined)
					?.version_number ?? 0,
			)
		: 0;
	const pages = renderDocumentPages(args.text);
	const { data, error } = await supabase
		.from("contract_document_versions")
		.insert({
			submission_id: args.submissionId,
			version_number: latestVersion + 1,
			source: args.source,
			rendered_text: args.text,
			rendered_html: pages.map((page) => `<section>${page}</section>`).join(""),
			form_data_snapshot: args.formData,
			created_by: args.createdBy ?? null,
		})
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
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
