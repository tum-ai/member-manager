// Shared SSRF guard. Any fetch whose URL is derived (even partially) from
// user-controlled input MUST be validated against a host allowlist before the
// request is made, so the endpoint can't be abused as an open proxy / SSRF
// vector. Mirrors the allowlist style used in routes/avatarProxy.ts.

export interface SsrfGuardOptions {
	// Exact hostnames that are permitted (case-insensitive).
	allowedHosts: Iterable<string>;
	// Suffixes (e.g. ".slack.com") that permit any subdomain. Always matched as
	// a dot-boundary suffix so "evilslack.com" can't slip past ".slack.com".
	allowedHostSuffixes?: Iterable<string>;
	// Protocols allowed. Defaults to https only.
	allowedProtocols?: Iterable<string>;
}

export class SsrfBlockedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SsrfBlockedError";
	}
}

function normalizeHost(host: string): string {
	return host.trim().toLowerCase();
}

// Returns true when `url` is safe to fetch under the given allowlist.
export function isUrlAllowed(
	url: string | URL,
	options: SsrfGuardOptions,
): boolean {
	let parsed: URL;
	try {
		parsed = url instanceof URL ? url : new URL(url);
	} catch {
		return false;
	}

	const allowedProtocols = new Set(
		[...(options.allowedProtocols ?? ["https:"])].map((p) => p.toLowerCase()),
	);
	if (!allowedProtocols.has(parsed.protocol.toLowerCase())) {
		return false;
	}

	const host = normalizeHost(parsed.hostname);
	if (!host) {
		return false;
	}

	const allowedHosts = new Set(
		[...options.allowedHosts].map((h) => normalizeHost(h)),
	);
	if (allowedHosts.has(host)) {
		return true;
	}

	for (const rawSuffix of options.allowedHostSuffixes ?? []) {
		const suffix = normalizeHost(rawSuffix);
		if (!suffix) continue;
		const dotted = suffix.startsWith(".") ? suffix : `.${suffix}`;
		if (host.endsWith(dotted)) {
			return true;
		}
	}

	return false;
}

// Throws SsrfBlockedError when the URL is not allowed; otherwise returns the
// parsed URL. Call this BEFORE fetching anything derived from user input.
export function assertUrlAllowed(
	url: string | URL,
	options: SsrfGuardOptions,
): URL {
	if (!isUrlAllowed(url, options)) {
		throw new SsrfBlockedError("URL host is not in the allowlist");
	}
	return url instanceof URL ? url : new URL(url);
}
