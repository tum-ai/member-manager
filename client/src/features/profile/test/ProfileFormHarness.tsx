import type { ReactNode } from "react";
import { FormProvider, type UseFormReturn, useForm } from "react-hook-form";
import {
	EMPTY_PROFILE_FORM_VALUES,
	type ProfileFormValues,
} from "@/features/profile/profileFormModel";

interface ProfileFormHarnessProps {
	/** Starting values, merged over the empty profile. */
	values?: Partial<ProfileFormValues>;
	/** Render prop: gets the live form, e.g. to show or change a value. */
	children: ReactNode | ((form: UseFormReturn<ProfileFormValues>) => ReactNode);
}

/** Provides the profile form context to a section under test. */
export function ProfileFormHarness({
	values,
	children,
}: ProfileFormHarnessProps): JSX.Element {
	const form = useForm<ProfileFormValues>({
		defaultValues: { ...EMPTY_PROFILE_FORM_VALUES, ...values },
	});
	return (
		<FormProvider {...form}>
			{typeof children === "function" ? children(form) : children}
		</FormProvider>
	);
}
