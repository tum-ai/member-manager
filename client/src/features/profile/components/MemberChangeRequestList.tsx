import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import {
	describeRequestedChanges,
	formatChangeRequestDate,
	getChangeRequestStatusBadgeVariant,
	getChangeRequestStatusLabel,
	partitionChangeRequests,
} from "@/features/profile/changeRequestUtils";
import type { MemberChangeRequest } from "@/hooks/useMemberChangeRequests";
import { cn } from "@/lib/utils";

interface MemberChangeRequestListProps {
	/** The member's own change requests, newest first (as the API returns them). */
	requests: readonly MemberChangeRequest[];
}

/**
 * Every change request the member has submitted: pending ones first, then
 * reviewed ones, each group newest first. Renders nothing when there are none.
 */
export function MemberChangeRequestList({
	requests,
}: MemberChangeRequestListProps): JSX.Element | null {
	const headingId = useId();
	if (requests.length === 0) return null;

	const { pending, reviewed } = partitionChangeRequests(requests);

	return (
		<section aria-labelledby={headingId} className="mt-6 border-t pt-5">
			<h3 id={headingId} className="text-sm font-semibold">
				Your requests
			</h3>
			<div className="mt-3 flex flex-col gap-5">
				{pending.length > 0 && (
					<RequestGroup title="Pending review" requests={pending} highlight />
				)}
				{reviewed.length > 0 && (
					<RequestGroup title="Reviewed" requests={reviewed} />
				)}
			</div>
		</section>
	);
}

function RequestGroup({
	title,
	requests,
	highlight = false,
}: {
	title: string;
	requests: readonly MemberChangeRequest[];
	highlight?: boolean;
}): JSX.Element {
	const titleId = useId();
	return (
		<div>
			<h4
				id={titleId}
				className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
			>
				{title}
			</h4>
			<ul aria-labelledby={titleId} className="flex flex-col gap-3">
				{requests.map((request) => (
					<RequestItem
						key={request.id}
						request={request}
						highlight={highlight}
					/>
				))}
			</ul>
		</div>
	);
}

function RequestItem({
	request,
	highlight,
}: {
	request: MemberChangeRequest;
	highlight: boolean;
}): JSX.Element {
	const entries = describeRequestedChanges(request.changes);
	const submittedOn = formatChangeRequestDate(request.created_at);

	return (
		<li
			className={cn(
				"rounded-lg border p-4",
				highlight ? "border-brand/20 bg-brand/5" : "border-border bg-muted/30",
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Badge variant={getChangeRequestStatusBadgeVariant(request.status)}>
					{getChangeRequestStatusLabel(request.status)}
				</Badge>
				{submittedOn && request.created_at && (
					<p className="text-xs text-muted-foreground">
						Submitted <time dateTime={request.created_at}>{submittedOn}</time>
					</p>
				)}
			</div>

			{entries.length > 0 ? (
				<dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
					{entries.map((entry) => (
						<RequestedChangeRow
							key={entry.label}
							label={entry.label}
							value={entry.value}
						/>
					))}
				</dl>
			) : (
				<p className="mt-3 text-sm text-muted-foreground">
					No change details recorded.
				</p>
			)}

			{request.reason && (
				<p className="mt-2 text-sm break-words text-muted-foreground">
					Reason: {request.reason}
				</p>
			)}
			{request.review_note && (
				<p className="mt-1 text-sm break-words">
					Review note: {request.review_note}
				</p>
			)}
		</li>
	);
}

function RequestedChangeRow({
	label,
	value,
}: {
	label: string;
	value: string;
}): JSX.Element {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-medium break-words whitespace-pre-line">{value}</dd>
		</>
	);
}
