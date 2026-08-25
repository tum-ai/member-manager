import { CONTRACT_DOCX_MIME_TYPE } from "@member-manager/shared";
import { apiClient } from "@/lib/apiClient";
import { supabase } from "@/lib/supabaseClient";

interface ContractUploadTicket {
	bucket: string;
	path: string;
	token: string;
	signed_url: string;
}

export interface ContractDocxUploadRef {
	storage_path: string;
	filename: string;
}

/**
 * Uploads a DOCX straight to Supabase Storage and returns the reference the API
 * needs. The bytes never pass through `/api/*`, whose function invocations cap
 * request bodies at 4.5 MB, which is less than the real contract templates.
 */
export async function uploadContractDocx(
	ticketUrl: string,
	file: File,
): Promise<ContractDocxUploadRef> {
	const ticket = await apiClient<ContractUploadTicket>(ticketUrl, {
		method: "POST",
		body: JSON.stringify({
			filename: file.name,
			// Some browsers report an empty type for .docx, so fall back to the
			// canonical one rather than failing a file the server would accept.
			mime_type: file.type || CONTRACT_DOCX_MIME_TYPE,
			size_bytes: file.size,
		}),
	});

	const { error } = await supabase.storage
		.from(ticket.bucket)
		.uploadToSignedUrl(ticket.path, ticket.token, file, {
			contentType: CONTRACT_DOCX_MIME_TYPE,
		});
	if (error) {
		throw new Error(error.message || "DOCX upload failed");
	}

	return { storage_path: ticket.path, filename: file.name };
}
