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
	/**
	 * Call after a successful save: the current values become the new baseline,
	 * so the form is pristine again and the refetch that follows the save does
	 * not look like an external change.
	 */
	markSaved: () => void;
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

	const markSaved = () => {
		form.reset(form.getValues(), { keepDirtyValues: false });
	};

	return { form, markSaved };
}
