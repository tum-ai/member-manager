import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/**
 * Makes `saved` the new baseline of `form` after a successful save, so the
 * saved fields stop counting as dirty (react-hook-form's
 * `keepDirtyValues` reset keeps the old dirty flags otherwise, and a dirty
 * field ignores later server updates).
 *
 * Anything typed while the request was in flight differs from `saved` and
 * stays an unsaved edit.
 */
export function rebaselineForm<T extends FieldValues>(
	form: UseFormReturn<T>,
	saved: T,
): void {
	const current = form.getValues();
	form.reset(saved, { keepDirtyValues: false });
	for (const key of Object.keys(current) as Path<T>[]) {
		if (current[key] !== saved[key]) {
			form.setValue(key, current[key], { shouldDirty: true });
		}
	}
}
