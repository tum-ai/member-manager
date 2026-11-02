/**
 * Supabase Auth's OAuth 2.1 server sends members here (Site URL +
 * `authorization_url_path`, `supabase/config.toml`) to approve an app, such as
 * an AI agent connecting to nomcp, the TUM.ai Notion MCP gateway.
 */
export const OAUTH_CONSENT_PATH = "/oauth/consent";

/** Where members see and revoke the apps they approved. */
export const CONNECTED_APPS_PATH = "/connected-apps";

/**
 * Sites of the AI apps members are expected to connect. A redirect anywhere
 * else is shown with a warning, because any app can register itself (dynamic
 * client registration) under any name.
 */
const KNOWN_APP_DOMAINS = [
	"claude.ai",
	"claude.com",
	"chatgpt.com",
	"openai.com",
];
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const UNSAFE_REDIRECT_PROTOCOLS = new Set([
	"javascript:",
	"data:",
	"vbscript:",
	"file:",
	"blob:",
]);

export interface RedirectTarget {
	/** What to show the member: the host, or scheme and host for app links. */
	label: string;
	/** A known AI app's site, or this computer (desktop and CLI agents). */
	isKnownApp: boolean;
}

function isKnownAppHost(hostname: string): boolean {
	return KNOWN_APP_DOMAINS.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
	);
}

/** Describes the app's registered redirect URI for the consent screen. */
export function describeRedirectTarget(redirectUri: string): RedirectTarget {
	let url: URL;
	try {
		url = new URL(redirectUri);
	} catch {
		return { label: redirectUri, isKnownApp: false };
	}
	if (url.protocol === "https:" || url.protocol === "http:") {
		const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
		return {
			label: url.host,
			isKnownApp:
				isLoopback ||
				(url.protocol === "https:" && isKnownAppHost(url.hostname)),
		};
	}
	// Desktop apps register their own scheme, e.g. cursor://...
	return { label: `${url.protocol}//${url.host}`, isKnownApp: false };
}

/**
 * Whether the browser may follow a redirect Supabase returned. Apps register
 * http(s) or their own scheme; script and local-file URLs are never followed.
 */
export function isFollowableRedirect(redirectUrl: string): boolean {
	try {
		return !UNSAFE_REDIRECT_PROTOCOLS.has(new URL(redirectUrl).protocol);
	} catch {
		return false;
	}
}

/** The `authorization_id` Supabase appends to the consent URL, if any. */
export function readAuthorizationId(search: string): string | null {
	return new URLSearchParams(search).get("authorization_id")?.trim() || null;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
	openid: "Confirm who you are",
	email: "See your email address",
	profile: "See your name and profile picture",
	phone: "See your phone number",
};

/** Supabase sends scopes space-separated; returns them de-duplicated. */
export function parseScopes(scope: string | null | undefined): string[] {
	return [...new Set((scope ?? "").split(/\s+/).filter(Boolean))];
}

export function describeScope(scope: string): string {
	return SCOPE_DESCRIPTIONS[scope] ?? scope;
}

/** "2 Nov 2026" for a grant timestamp; the raw value if it doesn't parse. */
export function formatGrantedAt(grantedAt: string): string {
	const date = new Date(grantedAt);
	return Number.isNaN(date.getTime())
		? grantedAt
		: date.toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
}
