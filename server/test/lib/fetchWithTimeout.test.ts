import assert from "node:assert";
import { afterEach, test } from "node:test";
import { fetchWithTimeout } from "../../src/lib/fetchWithTimeout.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("fetchWithTimeout cleans up external abort listeners", async () => {
	const externalController = new AbortController();
	let abortListenerAdds = 0;
	let abortListenerRemoves = 0;
	const originalAddEventListener =
		externalController.signal.addEventListener.bind(externalController.signal);
	const originalRemoveEventListener =
		externalController.signal.removeEventListener.bind(
			externalController.signal,
		);

	externalController.signal.addEventListener = ((type, listener, options) => {
		if (type === "abort") abortListenerAdds += 1;
		return originalAddEventListener(type, listener, options);
	}) as AbortSignal["addEventListener"];
	externalController.signal.removeEventListener = ((
		type,
		listener,
		options,
	) => {
		if (type === "abort") abortListenerRemoves += 1;
		return originalRemoveEventListener(type, listener, options);
	}) as AbortSignal["removeEventListener"];

	globalThis.fetch = async () => new Response("ok", { status: 200 });

	await fetchWithTimeout("https://example.com", {
		signal: externalController.signal,
	});

	assert.strictEqual(abortListenerAdds, 1);
	assert.strictEqual(abortListenerRemoves, 1);
});
