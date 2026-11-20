import {
	type FieldValues,
	type UseFormProps,
	type UseFormReturn,
	useForm,
} from "react-hook-form";

interface UseServerBackedFormOptions<TValues extends FieldValues>
	extends Omit<UseFormProps<TValues>, "values" | "resetOptions"> {
	/**
	 * The form's values as derived from the latest server snapshot, or
	 * `undefined` while that snapshot is still loading.
	 */
	serverValues: TValues | undefined;
}

export interface UseServerBackedFormResult<TValues extends FieldValues> {
	form: UseFormReturn<TValues>;
	/** True while the member has unsaved edits. */
	isDirty: boolean;
	/**
	 * Call after a successful save. `saved` (what the server stored) becomes the
	 * new baseline, so the form is pristine again and the refetch that follows
	 * the save does not look like an external change.
	 *
	 * Pass `submitted` (the values the save sent) too: anything the member
	 * typed while the request was in flight differs from it, is kept, and stays
	 * dirty instead of being reverted to the baseline.
	 */
	markSaved: (result?: { saved?: TValues; submitted?: TValues }) => void;
	/**
	 * Replace everything, edits included, with these values (e.g. "discard my
	 * changes and reload"). A plain `form.reset(values)` would not do: this
	 * hook configures `keepDirtyValues` for every reset.
	 */
	resetTo: (values: TValues) => void;
}

/**
 * A react-hook-form instance that stays in sync with server state without
 * ever discarding what the user is typing.
 *
 * Server state (TanStack Query) and the draft the user edits are different
 * things. Background refetches (window focus, reconnect, invalidation) must
 * update fields the user has not touched, and must never replace the ones
 * they have. This is react-hook-form's own `values` + `keepDirtyValues`
 * mechanism: `values` is deep-compared, so an unchanged snapshot (including a
 * new object with identical content) is a no-op, and a changed snapshot only
 * rewrites pristine fields.
 *
 * Use this for every form that edits a record loaded through a query. Never
 * call `reset()` from an effect that depends on query data or on the auth
 * `user` object: that overwrites unsaved input on every tab refocus.
 *
 * Keep the form model flat. `keepDirtyValues` has known gaps for nested
 * objects and field arrays.
 */
export function useServerBackedForm<TValues extends FieldValues>({
	serverValues,
	...formProps
}: UseServerBackedFormOptions<TValues>): UseServerBackedFormResult<TValues> {
	const form = useForm<TValues>({
		...formProps,
		values: serverValues,
		resetOptions: { keepDirtyValues: true },
	});

	// react-hook-form only applies the dirty-state updates of reset() while
	// `isDirty`/`dirtyFields` are subscribed (read during render). Without
	// this, a stale dirty flag survives a save and later pins the field to its
	// old value, so fresher server data would never reach it again.
	const { isDirty } = form.formState;
	void form.formState.dirtyFields;

	const resetTo = (values: TValues) => {
		form.reset(values, { keepDirtyValues: false });
	};
	const markSaved: UseServerBackedFormResult<TValues>["markSaved"] = ({
		saved,
		submitted,
	} = {}) => {
		const current = form.getValues();
		resetTo(saved ?? submitted ?? current);
		if (!submitted) return;
		// Keep what was typed after the save was submitted (flat model).
		for (const name of Object.keys(current) as Array<keyof TValues & string>) {
			if (!Object.is(current[name], submitted[name])) {
				form.setValue(name as never, current[name] as never, {
					shouldDirty: true,
				});
			}
		}
	};

	return { form, isDirty, markSaved, resetTo };
}
