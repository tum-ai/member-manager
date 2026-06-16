import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function LinkButton({
	className,
	asChild = false,
	type,
	...props
}: React.ComponentProps<"button"> & {
	asChild?: boolean;
}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="link-button"
			className={cn(
				"cursor-pointer rounded-sm text-brand underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			// A bare <button> defaults to type="submit"; the inline link buttons
			// migrated to this component live inside forms, so default to "button".
			{...(asChild ? {} : { type: type ?? "button" })}
			{...props}
		/>
	);
}

export { LinkButton };
