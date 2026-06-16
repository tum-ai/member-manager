import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	ConfidenceBadge,
	ProvenanceBadge,
	StatusBadge,
} from "./ProvenanceBadge";
import type { BeaconSource, ClaimStatus } from "./types";

export interface ClaimRowProps {
	title: string;
	subtitle?: string | null;
	entityTags?: string[];
	status: ClaimStatus;
	confidence: number;
	source: BeaconSource | null;
	editable: boolean;
	busy?: boolean;
	onConfirm?: () => void;
	onReject?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}

export function ClaimRow({
	title,
	subtitle,
	entityTags,
	status,
	confidence,
	source,
	editable,
	busy,
	onConfirm,
	onReject,
	onEdit,
	onDelete,
}: ClaimRowProps): JSX.Element {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-lg border bg-card/50 p-3 sm:flex-row sm:items-start sm:justify-between",
				status === "pending" && "border-amber-500/40 bg-amber-500/[0.03]",
				status === "rejected" && "opacity-60",
			)}
		>
			<div className="min-w-0 space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium leading-tight">{title}</span>
					{entityTags?.map((tag) => (
						<Badge key={tag} variant="outline" className="text-[11px]">
							{tag}
						</Badge>
					))}
				</div>
				{subtitle && (
					<p className="text-sm text-muted-foreground">{subtitle}</p>
				)}
				<div className="flex flex-wrap items-center gap-1.5">
					<StatusBadge status={status} />
					<ProvenanceBadge source={source} />
					<ConfidenceBadge confidence={confidence} source={source} />
				</div>
			</div>

			{editable && (
				<div className="flex shrink-0 items-center gap-1">
					{status !== "confirmed" && onConfirm && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onConfirm}
							disabled={busy}
						>
							<Check className="size-4" />
							Confirm
						</Button>
					)}
					{status === "pending" && onReject && (
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							aria-label="Reject"
							onClick={onReject}
							disabled={busy}
						>
							<X className="size-4" />
						</Button>
					)}
					{onEdit && (
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							aria-label="Edit"
							onClick={onEdit}
							disabled={busy}
						>
							<Pencil className="size-4" />
						</Button>
					)}
					{onDelete && (
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							aria-label="Delete"
							onClick={onDelete}
							disabled={busy}
							className="text-muted-foreground hover:text-destructive"
						>
							<Trash2 className="size-4" />
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
