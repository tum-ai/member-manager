/**
 * Explains on the sign-in page why someone ended up there, when it wasn't by
 * choice. There are two sources:
 *
 * - The OAuth redirect: when the database rejects a Slack sign-up from
 *   another workspace (`handle_new_user`), Supabase redirects back with
 *   `error_description=Database error saving new user`, in the query string
 *   or the hash.
 * - A notice remembered by `apiClient` before it signs out a session the API
 *   rejected with `SLACK_WORKSPACE_NOT_ALLOWED_ERROR`.
 */
export const WORKSPACE_NOT_ALLOWED_NOTICE =
	"Only members of the TUM.ai Slack workspace can sign in. Switch to your TUM.ai workspace in Slack and try again.";

/**
 * Supabase reports every failure while creating the account this way, not
 * only the workspace check, so the text names the likely cause without
 * claiming it.
 */
export const SIGNUP_REJECTED_NOTICE =
	"We couldn't create your account. Only members of the TUM.ai Slack workspace can sign in, so make sure you chose the TUM.ai workspace in Slack. If you did, contact the IT team.";

const NOTICE_STORAGE_KEY = "member-manager:auth-notice";
const SIGNUP_REJECTED_DESCRIPTION = "Database error saving new user";

/** The OAuth `error_description` from a redirect URL, or null if there is none. */
export function readOAuthErrorDescription(url: string): string | null {
	try {
		const parsed = new URL(url);
		const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
		const description =
			parsed.searchParams.get("error_description") ??
			hashParams.get("error_description");
		return description?.trim() || null;
	} catch {
		return null;
	}
}

/** Maps an OAuth redirect error to the text shown on the sign-in page. */
export function describeOAuthError(description: string): string {
	return description === SIGNUP_REJECTED_DESCRIPTION
		? SIGNUP_REJECTED_NOTICE
		: `Slack sign-in failed: ${description}`;
}

export function rememberAuthNotice(notice: string): void {
	try {
		window.sessionStorage.setItem(NOTICE_STORAGE_KEY, notice);
	} catch {
		// Storage can be unavailable (private mode); the notice is best effort.
	}
}

/** The remembered notice, if any. Reading it does not clear it. */
export function peekAuthNotice(): string | null {
	try {
		return window.sessionStorage.getItem(NOTICE_STORAGE_KEY);
	} catch {
		return null;
	}
}

/** Returns the remembered notice once, then forgets it. */
export function takeAuthNotice(): string | null {
	const notice = peekAuthNotice();
	try {
		window.sessionStorage.removeItem(NOTICE_STORAGE_KEY);
	} catch {
		// Nothing to clear when storage is unavailable.
	}
	return notice;
}

const OAUTH_ERROR_PARAMS = ["error", "error_code", "error_description"];

/**
 * The URL without the OAuth error parameters, in the query string or the
 * hash, so a reload doesn't show the same error again. Returns null when
 * there is nothing to strip.
 */
export function stripOAuthErrorParams(url: string): string | null {
	try {
		const parsed = new URL(url);
		const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
		const hasError = OAUTH_ERROR_PARAMS.some(
			(name) => parsed.searchParams.has(name) || hashParams.has(name),
		);
		if (!hasError) return null;
		for (const name of OAUTH_ERROR_PARAMS) {
			parsed.searchParams.delete(name);
			hashParams.delete(name);
		}
		const hash = hashParams.toString();
		parsed.hash = hash ? `#${hash}` : "";
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return null;
	}
}

function currentUrl(): string {
	return typeof window === "undefined" ? "" : window.location.href;
}

/**
 * The notice to show when the sign-in page opens: an OAuth redirect error
 * first, then one remembered by `apiClient`. Pure, so it is safe as a state
 * initializer (StrictMode calls those twice); pair it with
 * {@link consumeAuthNotice} in an effect.
 */
export function initialAuthNotice(url: string = currentUrl()): string {
	const description = readOAuthErrorDescription(url);
	if (description) return describeOAuthError(description);
	return peekAuthNotice() ?? "";
}

/**
 * Clears what {@link initialAuthNotice} read, so a reload or a later visit
 * to the sign-in page doesn't show it again: removes the OAuth error
 * parameters from the address bar and forgets the remembered notice.
 */
export function consumeAuthNotice(url: string = currentUrl()): void {
	takeAuthNotice();
	const cleanUrl = stripOAuthErrorParams(url);
	if (cleanUrl !== null && typeof window !== "undefined") {
		window.history.replaceState(window.history.state, "", cleanUrl);
	}
}
