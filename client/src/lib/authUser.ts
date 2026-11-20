import type { User } from "@supabase/supabase-js";

/**
 * supabase-js re-emits `SIGNED_IN` with a brand-new session object each time a
 * tab regains focus. For the same, unchanged user (same id and `updated_at`),
 * keep the reference already in state so consumers that depend on the object
 * do not see a change. A real update (`USER_UPDATED`) still comes through.
 */
export function keepSameUser(
	current: User | null,
	next: User | null,
): User | null {
	return current?.id === next?.id && current?.updated_at === next?.updated_at
		? current
		: next;
}
