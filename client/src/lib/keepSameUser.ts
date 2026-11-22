import type { User } from "@supabase/supabase-js";

/**
 * supabase-js re-emits `SIGNED_IN` with a brand-new user object every time the
 * browser tab regains focus. Reusing the previous reference while the user id
 * and `updated_at` are unchanged keeps effects and memos keyed on the user
 * from firing for a change that did not happen.
 */
export function keepSameUser(
	previous: User | null,
	next: User | null,
): User | null {
	if (
		previous &&
		next &&
		previous.id === next.id &&
		previous.updated_at === next.updated_at
	) {
		return previous;
	}
	return next;
}
