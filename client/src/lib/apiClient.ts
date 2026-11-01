import { SLACK_WORKSPACE_NOT_ALLOWED_ERROR } from "@member-manager/shared";
import { rememberAuthNotice, WORKSPACE_NOT_ALLOWED_NOTICE } from "./authNotice";
import { readJsonErrorMessage } from "./httpErrors";
import { supabase } from "./supabaseClient";

function isSecurePageContext(): boolean {
	if (typeof window === "undefined") {
		return true;
	}

	return (
		window.location.protocol === "https:" ||
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1"
	);
}

/**
 * Throws the API's error message for a failed authenticated request. A 401
 * means the backend rejected the session (expired, invalid, or outside the
 * TUM.ai Slack workspace), so the local session is cleared too, and a
 * workspace rejection leaves a notice for the sign-in page. Every helper
 * that sends the user's token should fail through here.
 */
export async function throwApiError(response: Response): Promise<never> {
	const message = await readJsonErrorMessage(response);
	if (response.status === 401) {
		if (message === SLACK_WORKSPACE_NOT_ALLOWED_ERROR) {
			rememberAuthNotice(WORKSPACE_NOT_ALLOWED_NOTICE);
		}
		await supabase.auth.signOut();
	}
	throw new Error(message);
}

// biome-ignore lint/suspicious/noExplicitAny: Generic API response
export async function apiClient<T = any>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	if (import.meta.env.PROD && !isSecurePageContext()) {
		throw new Error("The app must be served over HTTPS in production");
	}

	const {
		data: { session },
	} = await supabase.auth.getSession();
	const token = session?.access_token;
	const hasBody = options.body !== undefined && options.body !== null;
	const hasFormDataBody =
		typeof FormData !== "undefined" && options.body instanceof FormData;

	const headers: HeadersInit = {
		...(hasBody && !hasFormDataBody
			? { "Content-Type": "application/json" }
			: {}),
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...options.headers,
	};

	const response = await fetch(endpoint, {
		...options,
		headers,
	});

	if (!response.ok) {
		await throwApiError(response);
	}

	// 204 No Content has no body; callers may still `await` the result.
	if (response.status === 204) {
		return undefined as T;
	}

	return response.json();
}

export async function apiBlob(
	endpoint: string,
	options: RequestInit = {},
): Promise<Blob> {
	if (import.meta.env.PROD && !isSecurePageContext()) {
		throw new Error("The app must be served over HTTPS in production");
	}

	const {
		data: { session },
	} = await supabase.auth.getSession();
	const token = session?.access_token;

	const response = await fetch(endpoint, {
		...options,
		headers: {
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options.headers,
		},
	});

	if (!response.ok) {
		await throwApiError(response);
	}

	return response.blob();
}
