import type { User } from "@supabase/supabase-js";

/**
 * The user to keep in state after an auth event.
 *
 * supabase-js emits SIGNED_IN and TOKEN_REFRESHED again whenever the tab
 * regains focus, each with a freshly parsed `User` object for the same
 * account. Storing every one of them re-renders the whole app and re-runs
 * every effect that depends on `user`. The previous object is kept while the
 * account and its server-side `updated_at` are unchanged (#397).
 */
export function reuseUserIfUnchanged(
	current: User | null,
	next: User | null,
): User | null {
	if (
		current &&
		next &&
		current.id === next.id &&
		current.updated_at === next.updated_at
	) {
		return current;
	}

	return next;
}
