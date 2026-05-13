export const DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS = 10_000;

type FetchInput = Parameters<typeof fetch>[0];

interface MergedAbortSignal {
	signal: AbortSignal;
	cleanup: () => void;
}

function mergeAbortSignals(
	externalSignal: AbortSignal,
	timeoutSignal: AbortSignal,
): MergedAbortSignal {
	if (externalSignal.aborted) {
		return { signal: externalSignal, cleanup: () => undefined };
	}
	if (timeoutSignal.aborted) {
		return { signal: timeoutSignal, cleanup: () => undefined };
	}

	const controller = new AbortController();
	const abort = () => controller.abort();
	externalSignal.addEventListener("abort", abort, { once: true });
	timeoutSignal.addEventListener("abort", abort, { once: true });

	return {
		signal: controller.signal,
		cleanup: () => {
			externalSignal.removeEventListener("abort", abort);
			timeoutSignal.removeEventListener("abort", abort);
		},
	};
}

export async function fetchWithTimeout(
	input: FetchInput,
	init: RequestInit = {},
	timeoutMs = DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS,
): Promise<Response> {
	const timeoutController = new AbortController();
	const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
	const mergedSignal = init.signal
		? mergeAbortSignals(init.signal, timeoutController.signal)
		: { signal: timeoutController.signal, cleanup: () => undefined };

	try {
		return await fetch(input, { ...init, signal: mergedSignal.signal });
	} finally {
		clearTimeout(timeoutId);
		mergedSignal.cleanup();
	}
}
