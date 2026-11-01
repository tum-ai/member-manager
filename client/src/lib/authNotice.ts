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
		? WORKSPACE_NOT_ALLOWED_NOTICE
		: `Slack sign-in failed: ${description}`;
}

export function rememberAuthNotice(notice: string): void {
	try {
		window.sessionStorage.setItem(NOTICE_STORAGE_KEY, notice);
	} catch {
		// Storage can be unavailable (private mode); the notice is best effort.
	}
}

/** Returns the remembered notice once, then forgets it. */
export function takeAuthNotice(): string | null {
	try {
		const notice = window.sessionStorage.getItem(NOTICE_STORAGE_KEY);
		window.sessionStorage.removeItem(NOTICE_STORAGE_KEY);
		return notice;
	} catch {
		return null;
	}
}

/**
 * The notice to show when the sign-in page opens: an OAuth redirect error
 * first, then one remembered by `apiClient`.
 */
export function initialAuthNotice(
	url: string = typeof window === "undefined" ? "" : window.location.href,
): string {
	const description = readOAuthErrorDescription(url);
	const remembered = takeAuthNotice();
	if (description) return describeOAuthError(description);
	return remembered ?? "";
}
