export const DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS = 10_000;

type FetchInput = Parameters<typeof fetch>[0];

function mergeAbortSignals(
	externalSignal: AbortSignal,
	timeoutSignal: AbortSignal,
): AbortSignal {
	if (externalSignal.aborted) return externalSignal;
	if (timeoutSignal.aborted) return timeoutSignal;

	const controller = new AbortController();
	const abort = () => controller.abort();
	externalSignal.addEventListener("abort", abort, { once: true });
	timeoutSignal.addEventListener("abort", abort, { once: true });
	return controller.signal;
}

export async function fetchWithTimeout(
	input: FetchInput,
	init: RequestInit = {},
	timeoutMs = DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS,
): Promise<Response> {
	const timeoutController = new AbortController();
	const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
	const signal = init.signal
		? mergeAbortSignals(init.signal, timeoutController.signal)
		: timeoutController.signal;

	try {
		return await fetch(input, { ...init, signal });
	} finally {
		clearTimeout(timeoutId);
	}
}
