import type { AuthChangeEvent } from "@supabase/supabase-js";

/**
 * Supabase fires `TOKEN_REFRESHED` when the tab regains focus. The client
 * already stores the new JWT; pushing every refresh into React re-renders the
 * whole app for no user-visible change. Sync React only when auth membership
 * actually changes.
 */
const EVENTS_SYNC_USER_TO_REACT: ReadonlySet<AuthChangeEvent> = new Set([
	"INITIAL_SESSION",
	"SIGNED_IN",
	"SIGNED_OUT",
	"USER_UPDATED",
]);

export function shouldSyncAuthUserToReact(event: AuthChangeEvent): boolean {
	return EVENTS_SYNC_USER_TO_REACT.has(event);
}
