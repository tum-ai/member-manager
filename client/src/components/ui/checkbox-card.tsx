import type * as React from "react";
import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type CheckboxCardProps = Omit<React.ComponentProps<"label">, "onChange"> & {
	checked?: React.ComponentProps<typeof Checkbox>["checked"];
	defaultChecked?: React.ComponentProps<typeof Checkbox>["defaultChecked"];
	onCheckedChange?: React.ComponentProps<typeof Checkbox>["onCheckedChange"];
	disabled?: boolean;
	checkboxClassName?: string;
};

/**
 * A selectable card that wraps a {@link Checkbox} and arbitrary label content.
 * The whole card is a `<label>`, so clicking anywhere toggles the checkbox.
 */
function CheckboxCard({
	className,
	checked,
	defaultChecked,
	onCheckedChange,
	disabled,
	checkboxClassName,
	children,
	htmlFor,
	...props
}: CheckboxCardProps) {
	const generatedId = useId();
	const checkboxId = htmlFor ?? generatedId;
	return (
		<label
			data-slot="checkbox-card"
			htmlFor={checkboxId}
			className={cn(
				"group flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
				className,
			)}
			{...props}
		>
			<Checkbox
				id={checkboxId}
				className={cn("mt-1", checkboxClassName)}
				checked={checked}
				defaultChecked={defaultChecked}
				onCheckedChange={onCheckedChange}
				disabled={disabled}
			/>
			<span className="text-sm text-foreground">{children}</span>
		</label>
	);
}

export { CheckboxCard };
