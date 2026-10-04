// Session-scoped navigation state that has to survive the Slack OAuth round
// trip. Supabase sends the browser back to the bare origin after login
// (`getSlackRedirectUrl`), so a link like /welcome would otherwise be lost.
// The OAuth redirect happens in the same tab, so sessionStorage persists.
//
// Storage can be unavailable (private mode, blocked site data); every helper
// then degrades to "nothing remembered" instead of throwing.

const POST_LOGIN_PATH_KEY = "member-manager:post-login-path";
const WELCOME_SKIPPED_KEY = "member-manager:welcome-skipped";

function readSession(key: string): string | null {
	try {
		return window.sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeSession(key: string, value: string | null): void {
	try {
		if (value === null) {
			window.sessionStorage.removeItem(key);
		} else {
			window.sessionStorage.setItem(key, value);
		}
	} catch {
		// Storage unavailable: the redirect just won't be remembered.
	}
}

/** Only same-origin app paths; never a protocol-relative or absolute URL. */
function isAppPath(path: string): boolean {
	return path.startsWith("/") && !path.startsWith("//") && path !== "/";
}

/** Remembers where a logged-out visitor was heading, to resume after login. */
export function rememberPostLoginPath(path: string): void {
	if (isAppPath(path)) {
		writeSession(POST_LOGIN_PATH_KEY, path);
	}
}

/** Returns the remembered path once, then forgets it. */
export function consumePostLoginPath(): string | null {
	const path = readSession(POST_LOGIN_PATH_KEY);
	writeSession(POST_LOGIN_PATH_KEY, null);
	return path && isAppPath(path) ? path : null;
}

/** "Later" on /welcome: don't redirect there again in this browser session. */
export function markWelcomeSkipped(): void {
	writeSession(WELCOME_SKIPPED_KEY, "1");
}

export function isWelcomeSkipped(): boolean {
	return readSession(WELCOME_SKIPPED_KEY) === "1";
}
