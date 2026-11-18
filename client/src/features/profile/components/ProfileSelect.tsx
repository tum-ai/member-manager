import type * as React from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

/**
 * Profile-page Select. Inside a `<form>`, Radix mirrors into a hidden native
 * `<select>` and can emit `onValueChange("")` before options mount (#397).
 * That is not a user choice here (empty means `__none__`), so ignore it.
 */
function ProfileSelect({
	onValueChange,
	...props
}: React.ComponentProps<typeof Select>) {
	return (
		<Select
			{...props}
			onValueChange={
				onValueChange &&
				((value) => {
					if (value !== "") onValueChange(value);
				})
			}
		/>
	);
}

export {
	ProfileSelect,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
