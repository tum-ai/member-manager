import { Check, X } from "lucide-react";

export function AgreementChip({ accepted }: { accepted: boolean }) {
	const label = accepted ? "Accepted" : "Not accepted";
	return (
		<span role="img" title={label} aria-label={label} className="inline-flex">
			{accepted ? (
				<Check className="size-4 text-brand" aria-hidden="true" />
			) : (
				<X className="size-4 text-muted-foreground" aria-hidden="true" />
			)}
		</span>
	);
}
