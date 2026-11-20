import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useServerBackedForm } from "./useServerBackedForm";

interface Values {
	name: string;
	city: string;
}

function setup(initial: Values | undefined) {
	return renderHook(
		({ serverValues }: { serverValues: Values | undefined }) => {
			const backed = useServerBackedForm<Values>({
				serverValues,
				defaultValues: { name: "", city: "" },
			});
			return backed;
		},
		{ initialProps: { serverValues: initial } },
	);
}

describe("useServerBackedForm", () => {
	it("hydrates the form once the server snapshot arrives", () => {
		const { result, rerender } = setup(undefined);
		expect(result.current.form.getValues("name")).toBe("");

		rerender({ serverValues: { name: "Ada", city: "Munich" } });

		expect(result.current.form.getValues()).toEqual({
			name: "Ada",
			city: "Munich",
		});
	});

	it("keeps a typed value when an identical snapshot is re-delivered (#397)", () => {
		const { result, rerender } = setup({ name: "Ada", city: "Munich" });

		act(() => {
			result.current.form.setValue("name", "Grace", { shouldDirty: true });
		});
		// A new object with identical content, as after a focus refetch or a
		// re-created auth user.
		rerender({ serverValues: { name: "Ada", city: "Munich" } });

		expect(result.current.form.getValues("name")).toBe("Grace");
	});

	it("updates untouched fields but keeps edited ones when the snapshot changes", () => {
		const { result, rerender } = setup({ name: "Ada", city: "Munich" });

		act(() => {
			result.current.form.setValue("name", "Grace", { shouldDirty: true });
		});
		rerender({ serverValues: { name: "Ada L.", city: "Berlin" } });

		expect(result.current.form.getValues("name")).toBe("Grace");
		expect(result.current.form.getValues("city")).toBe("Berlin");
	});

	it("lets fresher server data reach a field again after it was saved", () => {
		const { result, rerender } = setup({ name: "Ada", city: "Munich" });

		act(() => {
			result.current.form.setValue("name", "Grace", { shouldDirty: true });
		});
		act(() => {
			result.current.markSaved();
		});
		// Someone else renames the member after the save.
		rerender({ serverValues: { name: "Margaret", city: "Munich" } });

		expect(result.current.form.getValues("name")).toBe("Margaret");
	});

	it("resetTo discards edits and takes the given values", () => {
		const { result } = setup({ name: "Ada", city: "Munich" });

		act(() => {
			result.current.form.setValue("name", "Grace", { shouldDirty: true });
		});
		act(() => {
			result.current.resetTo({ name: "Margaret", city: "Berlin" });
		});

		expect(result.current.form.getValues()).toEqual({
			name: "Margaret",
			city: "Berlin",
		});
		expect(result.current.isDirty).toBe(false);
	});

	it("markSaved makes the current values the pristine baseline", () => {
		const { result } = setup({ name: "Ada", city: "Munich" });

		act(() => {
			result.current.form.setValue("name", "Grace", { shouldDirty: true });
		});
		expect(result.current.isDirty).toBe(true);

		act(() => {
			result.current.markSaved();
		});

		expect(result.current.form.getValues("name")).toBe("Grace");
		expect(result.current.isDirty).toBe(false);
	});
});
