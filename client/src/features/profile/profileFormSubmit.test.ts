import { zodResolver } from "@hookform/resolvers/zod";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { type MemberSchema, memberSchema } from "@/lib/schemas";
import {
	describeSaveOutcome,
	reconcileFormAfterSave,
	toSavePart,
} from "./profileFormSubmit";

describe("toSavePart", () => {
	it("maps a fulfilled result to saved", () => {
		expect(toSavePart({ status: "fulfilled", value: {} })).toEqual({
			status: "saved",
		});
	});

	it("maps a skipped part", () => {
		expect(toSavePart("skipped")).toEqual({ status: "skipped" });
	});

	it("maps a rejection to failed with its message", () => {
		expect(
			toSavePart({ status: "rejected", reason: new Error("network down") }),
		).toEqual({ status: "failed", message: "network down" });
	});
});

describe("reconcileFormAfterSave", () => {
	it("clears dirty state when the server normalizes a saved field", () => {
		const { result } = renderHook(() =>
			useForm<MemberSchema>({
				resolver: zodResolver(memberSchema),
				defaultValues: {
					user_id: "user-1",
					public_location: "Munich ",
				} as MemberSchema,
			}),
		);

		act(() => {
			result.current.setValue("public_location", "Munich ", {
				shouldDirty: true,
			});
		});

		act(() => {
			reconcileFormAfterSave(
				result.current,
				{
					...(result.current.getValues() as MemberSchema),
					public_location: "Munich",
				},
				{ ...result.current.getValues(), public_location: "Munich " },
			);
		});

		expect(result.current.getValues("public_location")).toBe("Munich");
		expect(result.current.formState.isDirty).toBe(false);
	});

	it("keeps only fields edited while the save request was in flight", () => {
		const { result } = renderHook(() =>
			useForm<MemberSchema>({
				resolver: zodResolver(memberSchema),
				defaultValues: {
					user_id: "user-1",
					city: "Munich",
					salutation: "Ms.",
				} as MemberSchema,
			}),
		);

		const atSubmit = result.current.getValues();
		act(() => {
			result.current.setValue("city", "Berlin", { shouldDirty: true });
		});

		act(() => {
			reconcileFormAfterSave(
				result.current,
				{ ...atSubmit, city: "Munich" },
				atSubmit,
			);
		});

		expect(result.current.getValues("city")).toBe("Berlin");
		expect(result.current.formState.dirtyFields.city).toBe(true);
		expect(result.current.formState.dirtyFields.salutation).toBeUndefined();
	});
});

describe("describeSaveOutcome", () => {
	it("reports full success", () => {
		expect(
			describeSaveOutcome({
				member: { status: "saved" },
				sepa: { status: "skipped" },
			}),
		).toEqual({ message: "Profile saved successfully!", type: "success" });
	});

	it("names a member failure after bank details saved", () => {
		expect(
			describeSaveOutcome({
				member: { status: "failed", message: "timeout" },
				sepa: { status: "saved" },
			}),
		).toEqual({
			message: "Bank details saved, but your profile was not: timeout",
			type: "error",
		});
	});
});
