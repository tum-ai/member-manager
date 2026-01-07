import { supabase } from "./supabaseClient";

// biome-ignore lint/suspicious/noExplicitAny: Generic API response
export async function apiClient<T = any>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	const token = session?.access_token;

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...options.headers,
	};

	const response = await fetch(endpoint, {
		...options,
		headers,
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || response.statusText);
	}

	return response.json();
}
