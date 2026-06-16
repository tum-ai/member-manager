import { ExternalLink, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BeaconSource, ClaimStatus } from "./types";

const STATUS_META: Record<
	ClaimStatus,
	{ label: string; variant: "success" | "warning" | "neutral" }
> = {
	confirmed: { label: "Confirmed", variant: "success" },
	pending: { label: "Needs review", variant: "warning" },
	rejected: { label: "Rejected", variant: "neutral" },
};

export function StatusBadge({ status }: { status: ClaimStatus }): JSX.Element {
	const meta = STATUS_META[status];
	return (
		<Badge variant={meta.variant} className="gap-1">
			{meta.label}
		</Badge>
	);
}

// Where the claim came from. A null source = self-reported by the member.
export function ProvenanceBadge({
	source,
}: {
	source: BeaconSource | null;
}): JSX.Element {
	if (!source) {
		return (
			<Badge variant="accent" className="gap-1">
				<UserRound className="size-3" />
				Self-reported
			</Badge>
		);
	}

	const label = source.title || source.kind;
	const inner = (
		<Badge variant="info" className="gap-1">
			{source.identity_confirmed ? (
				<ShieldCheck className="size-3" />
			) : (
				<Sparkles className="size-3" />
			)}
			{label}
			{source.url && <ExternalLink className="size-3 opacity-70" />}
		</Badge>
	);

	const tip = `${source.kind}${
		source.identity_confirmed ? " · identity confirmed" : " · discovered"
	}`;

	const badge = source.url ? (
		<a
			href={source.url}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex"
		>
			{inner}
		</a>
	) : (
		inner
	);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{badge}</TooltipTrigger>
				<TooltipContent>{tip}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// Confidence as a colored pill. Hidden for self-reported (confidence 1) since
// "Self-reported" already conveys certainty.
export function ConfidenceBadge({
	confidence,
	source,
}: {
	confidence: number;
	source: BeaconSource | null;
}): JSX.Element | null {
	if (!source && confidence >= 1) return null;
	const pct = Math.round(confidence * 100);
	const variant =
		confidence >= 0.8 ? "success" : confidence >= 0.5 ? "warning" : "danger";
	return (
		<Badge variant={variant} className="tabular-nums">
			{pct}% confident
		</Badge>
	);
}
