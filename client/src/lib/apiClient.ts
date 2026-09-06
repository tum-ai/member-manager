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
		if (response.status === 401) {
			// Clear local session if backend rejected the token as invalid/stale
			await supabase.auth.signOut();
		}
		throw new Error(await readJsonErrorMessage(response));
	}

	// 204 No Content has no body; callers may still `await` the result.
	if (response.status === 204) {
		return undefined as T;
	}

	return response.json();
}

// POST a JSON body and consume a Server-Sent Events response, invoking
// `onEvent` for each `data:` frame. Uses fetch + a ReadableStream reader (not
// EventSource) because auth is a Bearer header. Resolves when the stream ends.
export async function apiStream(
	endpoint: string,
	body: unknown,
	onEvent: (event: unknown) => void,
): Promise<void> {
	if (import.meta.env.PROD && !isSecurePageContext()) {
		throw new Error("The app must be served over HTTPS in production");
	}

	const {
		data: { session },
	} = await supabase.auth.getSession();
	const token = session?.access_token;

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});

	if (response.status === 401) {
		await supabase.auth.signOut();
		throw new Error("Your session expired. Please sign in again.");
	}
	if (!response.ok || !response.body) {
		throw new Error(await readJsonErrorMessage(response));
	}
	if (
		!(response.headers.get("content-type") ?? "").includes("text/event-stream")
	) {
		throw new Error("The server returned an invalid event stream");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const consumeFrame = (frame: string) => {
		const payload = frame
			.split("\n")
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trimStart())
			.join("\n")
			.trim();
		if (!payload) return;
		try {
			onEvent(JSON.parse(payload));
		} catch {
			throw new Error("The server sent an invalid event");
		}
	};
	try {
		for (;;) {
			const { value, done } = await reader.read();
			buffer += done
				? decoder.decode()
				: decoder.decode(value, { stream: true });
			buffer = buffer.replace(/\r\n/g, "\n");
			for (;;) {
				const index = buffer.indexOf("\n\n");
				if (index < 0) break;
				consumeFrame(buffer.slice(0, index));
				buffer = buffer.slice(index + 2);
			}
			if (done) break;
		}
		if (buffer.trim()) consumeFrame(buffer);
	} finally {
		reader.releaseLock();
	}
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
		throw new Error(await readJsonErrorMessage(response));
	}

	return response.blob();
}
