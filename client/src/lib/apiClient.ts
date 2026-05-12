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

async function readErrorMessage(response: Response): Promise<string> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return response.statusText;
	}

	const errorData = (await response.json()) as {
		error?: unknown;
		message?: unknown;
	};
	if (typeof errorData.error === "string") return errorData.error;
	if (typeof errorData.message === "string") return errorData.message;
	return response.statusText;
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

	const headers: HeadersInit = {
		...(hasBody ? { "Content-Type": "application/json" } : {}),
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...options.headers,
	};

	const response = await fetch(endpoint, {
		...options,
		headers,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	// 204 No Content has no body; callers may still `await` the result.
	if (response.status === 204) {
		return undefined as T;
	}

	return response.json();
}
