import type {
	PublicBoardSignPayload,
	PublicSignPayload,
} from "@member-manager/shared";
import { apiBlob } from "@/lib/apiClient";

async function requestPublicContract(
	endpoint: string,
	options?: RequestInit,
): Promise<Response> {
	const response = await fetch(endpoint, options);
	if (!response.ok) {
		const errorBody = (await response.json().catch(() => ({}))) as {
			error?: unknown;
		};
		const message =
			typeof errorBody.error === "string"
				? errorBody.error
				: response.statusText;
		throw new Error(message);
	}
	return response;
}

function publicJsonRequest(body: unknown): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	};
}

function saveBlob(blob: Blob, filename: string): void {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}

export async function downloadContractSubmissionPdf(
	submissionId: string,
): Promise<void> {
	const blob = await apiBlob(`/api/contracts/submissions/${submissionId}/pdf`);
	saveBlob(blob, `contract-${submissionId}.pdf`);
}

export async function fetchPublicSignPayload(
	token: string,
): Promise<PublicSignPayload> {
	const response = await requestPublicContract(
		`/api/contracts/sign/${encodeURIComponent(token)}`,
	);
	return response.json();
}

export async function postPublicSignature(
	token: string,
	body: { signature_data: string; signer_name: string },
): Promise<void> {
	await requestPublicContract(
		`/api/contracts/sign/${encodeURIComponent(token)}`,
		publicJsonRequest(body),
	);
}

export async function postPublicComment(
	token: string,
	body: { comment: string },
): Promise<void> {
	await requestPublicContract(
		`/api/contracts/sign/${encodeURIComponent(token)}/comment`,
		publicJsonRequest(body),
	);
}

export async function fetchPublicBoardSignPayload(
	token: string,
): Promise<PublicBoardSignPayload> {
	const response = await requestPublicContract(
		`/api/contracts/board-sign/${encodeURIComponent(token)}`,
	);
	return response.json();
}

export async function postPublicBoardSignature(
	token: string,
	body: { signature_data: string; signer_name: string },
): Promise<void> {
	await requestPublicContract(
		`/api/contracts/board-sign/${encodeURIComponent(token)}`,
		publicJsonRequest(body),
	);
}
