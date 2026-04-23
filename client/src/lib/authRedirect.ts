const LOCALHOST_FALLBACK = "http://localhost:5173/";

function ensureTrailingSlash(url: string): string {
	return url.endsWith("/") ? url : `${url}/`;
}

export function getSlackRedirectUrl({
	currentOrigin,
	configuredRedirectUrl,
}: {
	currentOrigin?: string | null;
	configuredRedirectUrl?: string | null;
} = {}): string {
	const runtimeOrigin = currentOrigin?.trim();
	if (runtimeOrigin) {
		return ensureTrailingSlash(runtimeOrigin);
	}

	const configured = configuredRedirectUrl?.trim();
	if (configured) {
		return ensureTrailingSlash(configured);
	}

	return LOCALHOST_FALLBACK;
}
