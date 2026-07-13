import type { ContractWorkflowStatus } from "@member-manager/shared";
import { getContractStatusLabel } from "@/features/contracts/contractStatus";
import type { ContractStatusEvent } from "@/features/contracts/useContracts";

interface ContractStatusTimelineProps {
	events: ContractStatusEvent[];
	loading?: boolean;
}

/**
 * Marker note set by the server when a status was changed via the manual
 * override dropdown (round 2 Nr.7) rather than a workflow button.
 */
export const MANUAL_STATUS_CHANGE_NOTE = "Manual override";

function statusLabel(status: string | null): string {
	if (!status) return "—";
	return getContractStatusLabel(status as ContractWorkflowStatus);
}

function eventPhrase(event: ContractStatusEvent): JSX.Element {
	// Round 2 Nr.2: the initial event has no from_status — phrase it as the
	// submission itself instead of a "— → X" transition.
	if (!event.from_status) {
		if (event.to_status === "draft") {
			return <span className="font-medium">Draft created</span>;
		}
		return (
			<>
				Submitted as{" "}
				<span className="font-medium">{statusLabel(event.to_status)}</span>
			</>
		);
	}
	if (event.note === MANUAL_STATUS_CHANGE_NOTE) {
		return (
			<>
				Status manually changed from {statusLabel(event.from_status)} to{" "}
				<span className="font-medium">{statusLabel(event.to_status)}</span>
			</>
		);
	}
	return (
		<>
			{statusLabel(event.from_status)} →{" "}
			<span className="font-medium">{statusLabel(event.to_status)}</span>
		</>
	);
}

/**
 * Nr.3: compact history of status transitions so a previous status stays
 * visible after it has been superseded (e.g. "Partner signed" is still shown
 * after a later clarification request).
 */
export function ContractStatusTimeline({
	events,
	loading,
}: ContractStatusTimelineProps): JSX.Element | null {
	if (loading) return null;
	if (events.length === 0) return null;

	return (
		<ol className="flex flex-col gap-2">
			{events.map((event) => (
				<li key={event.id} className="flex items-baseline gap-2 text-sm">
					<span
						className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
						aria-hidden="true"
					/>
					<span className="text-muted-foreground">
						{new Date(event.created_at).toLocaleString()}
					</span>
					<span>
						{eventPhrase(event)}
						{event.changed_by_name ? (
							<span className="text-muted-foreground">
								{" "}
								by {event.changed_by_name}
							</span>
						) : null}
					</span>
				</li>
			))}
		</ol>
	);
}
