import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { rebaselineForm } from "./rebaselineForm";

describe("rebaselineForm", () => {
	function setup() {
		return renderHook(() => {
			const form = useForm({ defaultValues: { a: "1", b: "2" } });
			// Subscribe to dirtyFields, as the profile hook does.
			void form.formState.dirtyFields;
			return form;
		}).result;
	}

	it("clears the dirty state of saved fields and keeps their values", () => {
		const form = setup();
		act(() => form.current.setValue("a", "x", { shouldDirty: true }));
		expect(form.current.formState.dirtyFields.a).toBe(true);

		act(() => rebaselineForm(form.current, { a: "x", b: "2" }));

		expect(form.current.getValues()).toEqual({ a: "x", b: "2" });
		expect(form.current.formState.dirtyFields.a).toBeUndefined();
	});

	it("keeps edits made after the saved snapshot as unsaved", () => {
		const form = setup();
		act(() => form.current.setValue("a", "x", { shouldDirty: true }));
		act(() => form.current.setValue("b", "typed later", { shouldDirty: true }));

		act(() => rebaselineForm(form.current, { a: "x", b: "2" }));

		expect(form.current.getValues("b")).toBe("typed later");
		expect(form.current.formState.dirtyFields.b).toBe(true);
		expect(form.current.formState.dirtyFields.a).toBeUndefined();
	});
});
