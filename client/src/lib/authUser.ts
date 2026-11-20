import type { User } from "@supabase/supabase-js";

/**
 * supabase-js re-emits `SIGNED_IN` with a brand-new session object each time a
 * tab regains focus. For the same user, keep the reference already in state so
 * consumers that depend on the object do not see a change.
 */
export function keepSameUser(
	current: User | null,
	next: User | null,
): User | null {
	return current?.id === next?.id ? current : next;
}
