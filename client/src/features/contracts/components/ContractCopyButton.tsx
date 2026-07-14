import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/ToastContext";

export function ContractCopyButton({
	value,
	ariaLabel = "Copy to clipboard",
}: {
	value: string;
	ariaLabel?: string;
}): JSX.Element {
	const { showToast } = useToast();

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label={ariaLabel}
			onClick={() => {
				navigator.clipboard
					.writeText(value)
					.then(() => showToast("Copied to clipboard", "success"))
					.catch(() => showToast("Could not copy", "error"));
			}}
		>
			<Copy className="size-4" />
		</Button>
	);
}
