import type { SuggestedField } from "@/features/profile/profileFormModel";

/** Marks a prefilled field as a suggestion until the member saves it. */
export function suggestionHint(
	suggestedFields: readonly SuggestedField[],
	field: SuggestedField,
): string | undefined {
	return suggestedFields.includes(field)
		? "Suggested for you. Save to keep it."
		: undefined;
}
