import type {
	CaptureResult,
	PostHog,
	Properties,
} from "posthog-js/dist/module.slim";

// PostHog product analytics.
//
// Disabled unless `VITE_POSTHOG_KEY` is set, so local dev, CI, Vitest and
// Storybook never talk to PostHog: every exported function is a no-op and the
// `posthog-js` chunk is never even downloaded (it is `import()`ed lazily inside
// `initAnalytics`, keeping ~70 kB gzipped out of the main bundle).
//
// Privacy posture (see docs/analytics.md): this app renders IBANs, addresses,
// dates of birth and signed contract links, so autocapture and session replay
// are OFF by default and every URL-shaped property is redacted in `before_send`
// before it leaves the browser.

type AnalyticsBrowserEnv = {
	PROD?: boolean;
	VITE_POSTHOG_KEY?: string;
	VITE_POSTHOG_HOST?: string;
	VITE_POSTHOG_UI_HOST?: string;
	VITE_POSTHOG_AUTOCAPTURE?: string;
	VITE_POSTHOG_SESSION_RECORDING?: string;
	VITE_POSTHOG_IDENTIFY_EMAIL?: string;
	VITE_POSTHOG_DEBUG?: string;
};

export type AnalyticsConfig = {
	apiKey: string;
	apiHost: string;
	uiHost: string;
	autocapture: boolean;
	sessionRecording: boolean;
	identifyEmail: boolean;
	debug: boolean;
};

export type AnalyticsIdentity = {
	userId: string;
	email?: string | null;
};

const DEFAULT_API_HOST = "https://eu.i.posthog.com";
const DEFAULT_UI_HOST = "https://eu.posthog.com";

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const REDACTED_SEGMENT = ":redacted";

// Routes whose trailing segment is a secret (the partner/board signing tokens
// grant contract access to anyone holding them) or an unbounded id. Collapsing
// them to the route template keeps PostHog's "pathname" breakdown readable and
// keeps the secrets out of it.
const PATH_TEMPLATES: readonly (readonly [RegExp, string])[] = [
	[/^\/contracts\/sign\/[^/]+/, "/contracts/sign/:token"],
	[/^\/contracts\/board-sign\/[^/]+/, "/contracts/board-sign/:token"],
	[/^\/contracts\/drafts\/[^/]+/, "/contracts/drafts/:draftId"],
	[/^\/contracts\/submissions\/[^/]+/, "/contracts/submissions/:id"],
];

const UUID_SEGMENT =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Long opaque segments are ids or tokens; short human-readable ones are routes.
const OPAQUE_SEGMENT = /^[A-Za-z0-9._~-]{20,}$/;

/**
 * Collapse identifiers and secrets out of a pathname before it is captured.
 * Unknown routes still get generic UUID/long-token redaction, so a route added
 * later is redacted by default rather than leaking until someone remembers.
 */
export function redactAnalyticsPath(pathname: string): string {
	for (const [pattern, template] of PATH_TEMPLATES) {
		if (pattern.test(pathname)) {
			return template;
		}
	}

	return pathname
		.split("/")
		.map((segment) =>
			UUID_SEGMENT.test(segment) || OPAQUE_SEGMENT.test(segment)
				? REDACTED_SEGMENT
				: segment,
		)
		.join("/");
}

/**
 * Redact a full URL: the query string and the fragment are dropped wholesale
 * (Supabase returns OAuth sessions as `#access_token=...`, and signed links
 * carry tokens in the query), and the path runs through `redactAnalyticsPath`.
 */
export function redactAnalyticsUrl(rawUrl: string): string {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return redactAnalyticsPath(rawUrl);
	}

	url.search = "";
	url.hash = "";
	url.pathname = redactAnalyticsPath(url.pathname);
	return url.toString();
}

const URL_VALUED_PROPERTIES = [
	"$current_url",
	"$referrer",
	"$initial_current_url",
	"$initial_referrer",
	"$session_entry_url",
	"$session_entry_referrer",
] as const;

const PATH_VALUED_PROPERTIES = [
	"$pathname",
	"$initial_pathname",
	"$session_entry_pathname",
] as const;

/**
 * `before_send` hook. Runs on every event PostHog sends — ours, autocaptured
 * ones, `$pageleave`, web vitals — so redaction cannot be forgotten at a call
 * site.
 */
export function redactCaptureResult(
	result: CaptureResult | null,
): CaptureResult | null {
	if (!result?.properties) {
		return result;
	}

	const properties: Properties = { ...result.properties };

	for (const key of URL_VALUED_PROPERTIES) {
		const value = properties[key];
		if (typeof value === "string") {
			properties[key] = redactAnalyticsUrl(value);
		}
	}

	for (const key of PATH_VALUED_PROPERTIES) {
		const value = properties[key];
		if (typeof value === "string") {
			properties[key] = redactAnalyticsPath(value);
		}
	}

	return { ...result, properties };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
	const value = raw?.trim().toLowerCase();
	if (!value) {
		return fallback;
	}
	return value === "true" || value === "1" || value === "yes";
}

function assertPublicProjectKey(apiKey: string): void {
	// `phx_` (personal) and `phs_` (secret) keys can read and write the whole
	// PostHog project. Only the `phc_` project key belongs in a browser bundle.
	if (apiKey.startsWith("phx_") || apiKey.startsWith("phs_")) {
		throw new Error(
			"VITE_POSTHOG_KEY looks like a PostHog personal/secret API key. Use the project API key (phc_...), which is the only one safe to ship in the browser bundle.",
		);
	}
}

function normalizeApiHost(
	rawHost: string | undefined,
	isProduction: boolean,
): string {
	const host = rawHost?.trim() || DEFAULT_API_HOST;

	// A same-origin path (e.g. "/ingest") means requests go through the app's
	// own reverse proxy - see the `/ingest` rewrites in vercel.json.
	if (host.startsWith("/")) {
		return host.replace(/\/+$/, "") || "/";
	}

	let url: URL;
	try {
		url = new URL(host);
	} catch {
		throw new Error(
			"VITE_POSTHOG_HOST must be an absolute URL or a same-origin path such as /ingest",
		);
	}

	if (isProduction && url.protocol !== "https:") {
		throw new Error("VITE_POSTHOG_HOST must use HTTPS in production");
	}

	return host.replace(/\/+$/, "");
}

/**
 * The PostHog *app* URL, used for toolbar links. Derived from the ingestion host
 * (`https://us.i.posthog.com` -> `https://us.posthog.com`) so a US-cloud or
 * self-hosted deployment does not silently point at the EU app; only needed
 * explicitly when the ingestion host is the `/ingest` proxy.
 */
function deriveUiHost(apiHost: string, override: string | undefined): string {
	const explicit = override?.trim();
	if (explicit) {
		return explicit;
	}

	if (apiHost.startsWith("/")) {
		return DEFAULT_UI_HOST;
	}

	const url = new URL(apiHost);
	url.hostname = url.hostname.replace(
		/^([a-z0-9-]+)\.i\.posthog\.com$/i,
		"$1.posthog.com",
	);
	return url.origin;
}

/**
 * Returns `null` when analytics is simply not configured (no key). Throws when
 * a key *is* configured but the rest of the config is unusable, so a
 * misconfigured deployment is loud instead of silently untracked.
 */
export function getAnalyticsConfigFromEnv(
	env: AnalyticsBrowserEnv,
): AnalyticsConfig | null {
	const apiKey = env.VITE_POSTHOG_KEY?.trim();
	if (!apiKey) {
		return null;
	}

	assertPublicProjectKey(apiKey);

	const apiHost = normalizeApiHost(env.VITE_POSTHOG_HOST, env.PROD === true);

	return {
		apiKey,
		apiHost,
		uiHost: deriveUiHost(apiHost, env.VITE_POSTHOG_UI_HOST),
		autocapture: parseBooleanFlag(env.VITE_POSTHOG_AUTOCAPTURE, false),
		sessionRecording: parseBooleanFlag(
			env.VITE_POSTHOG_SESSION_RECORDING,
			false,
		),
		identifyEmail: parseBooleanFlag(env.VITE_POSTHOG_IDENTIFY_EMAIL, false),
		debug: parseBooleanFlag(env.VITE_POSTHOG_DEBUG, false),
	};
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let client: PostHog | null = null;
let activeConfig: AnalyticsConfig | null = null;
let clientPromise: Promise<PostHog | null> | null = null;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function loadClient(env: AnalyticsBrowserEnv): Promise<PostHog | null> {
	if (typeof window === "undefined") {
		return null;
	}

	let config: AnalyticsConfig | null;
	try {
		config = getAnalyticsConfigFromEnv(env);
	} catch (error) {
		console.error(`PostHog analytics disabled: ${getErrorMessage(error)}`);
		return null;
	}

	if (!config) {
		return null;
	}

	try {
		// The "slim" build halves the gzipped chunk (~47 kB vs ~93 kB) by leaving
		// out the bundled surveys / product-tours UI, which this config never turns
		// on. Anything still needed at runtime (e.g. the session replay recorder) is
		// fetched from PostHog's asset host on demand.
		const { default: posthog } = await import("posthog-js/dist/module.slim");

		activeConfig = config;
		client = posthog.init(config.apiKey, {
			api_host: config.apiHost,
			ui_host: config.uiHost,
			// Pin the config-defaults snapshot so a posthog-js upgrade cannot
			// silently switch behaviour (e.g. re-enable automatic pageviews).
			defaults: "2025-05-24",
			// Only users we explicitly `identify` get a person profile; anonymous
			// visitors on the public signing pages stay anonymous.
			person_profiles: "identified_only",
			// Off by default: autocapture records the text and structure of clicked
			// elements, which on this app can include member names and bank details.
			autocapture: config.autocapture,
			// AnalyticsTracker captures redacted pageviews from React Router.
			capture_pageview: false,
			capture_pageleave: true,
			disable_session_recording: !config.sessionRecording,
			session_recording: {
				maskAllInputs: true,
				maskTextSelector: "[data-ph-mask]",
			},
			before_send: redactCaptureResult,
			debug: config.debug,
		});

		return client;
	} catch (error) {
		console.error("Failed to initialise PostHog analytics:", error);
		activeConfig = null;
		return null;
	}
}

/**
 * Load and initialise PostHog once. Safe to call when unconfigured (resolves to
 * `null` without a network request) and safe to call more than once.
 */
export function initAnalytics(
	env: AnalyticsBrowserEnv = import.meta.env,
): Promise<PostHog | null> {
	if (!clientPromise) {
		clientPromise = loadClient(env);
	}
	return clientPromise;
}

/**
 * Run `fn` against the PostHog client: synchronously once loaded, queued behind
 * the in-flight load otherwise, and dropped entirely when analytics is off.
 * Queued calls stay in order because they chain off the same promise.
 */
function withClient(fn: (posthog: PostHog) => void): void {
	if (client) {
		fn(client);
		return;
	}

	if (!clientPromise) {
		return;
	}

	void clientPromise.then((loaded) => {
		if (loaded) {
			fn(loaded);
		}
	});
}

/**
 * Subscribe to the client. Returns an unsubscribe function that is safe to call
 * before the client has finished loading.
 */
export function onAnalyticsClient(
	fn: (posthog: PostHog) => (() => void) | undefined,
): () => void {
	let cancelled = false;
	let cleanup: (() => void) | undefined;

	withClient((posthog) => {
		if (cancelled) {
			return;
		}
		cleanup = fn(posthog);
	});

	return () => {
		cancelled = true;
		cleanup?.();
	};
}

export function isAnalyticsEnabled(): boolean {
	return client !== null;
}

export function captureAnalyticsEvent(
	event: string,
	properties?: Properties,
): void {
	withClient((posthog) => {
		posthog.capture(event, properties);
	});
}

export function captureAnalyticsPageview(): void {
	// `$current_url` / `$pathname` are filled in by posthog-js from
	// `window.location` and redacted by `before_send`.
	captureAnalyticsEvent("$pageview");
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
	withClient((posthog) => {
		const properties: Properties = {};
		// Email is PII: only sent when the deployment opts in explicitly.
		if (activeConfig?.identifyEmail && identity.email) {
			properties.email = identity.email;
		}
		posthog.identify(identity.userId, properties);
	});
}

export function setAnalyticsPersonProperties(properties: Properties): void {
	withClient((posthog) => {
		posthog.setPersonProperties(properties);
	});
}

/** Clear the identified person and start a fresh anonymous session. */
export function resetAnalytics(): void {
	withClient((posthog) => {
		posthog.reset();
	});
}
