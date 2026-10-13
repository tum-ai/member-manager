import type { MemberDoorPin } from "@member-manager/shared";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/GlassCard";
import { InfoBox } from "@/components/ui/info-box";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { SectionHeading } from "./SectionHeading";

export const DOOR_PIN_SECTION_ID = "door-pin";

interface DoorPinSectionProps {
	doorPin: MemberDoorPin | undefined;
	isLoading: boolean;
	hasError: boolean;
	isRevealed: boolean;
	onToggleRevealed: () => void;
}

/**
 * The member's PIN for the office key cabinet. Read-only: admins manage PINs.
 * The PIN stays masked until the member asks to see it.
 */
export function DoorPinSection({
	doorPin,
	isLoading,
	hasError,
	isRevealed,
	onToggleRevealed,
}: DoorPinSectionProps): JSX.Element {
	return (
		<GlassCard
			id={DOOR_PIN_SECTION_ID}
			variant="elevated"
			className="scroll-mt-20"
		>
			<CardContent className="p-6">
				<SectionHeading
					icon={KeyRound}
					title="Door PIN"
					description="Your personal PIN for the TUM.ai office key cabinet. Don't share it."
				/>
				<DoorPinBody
					doorPin={doorPin}
					isLoading={isLoading}
					hasError={hasError}
					isRevealed={isRevealed}
					onToggleRevealed={onToggleRevealed}
				/>
			</CardContent>
		</GlassCard>
	);
}

function DoorPinBody({
	doorPin,
	isLoading,
	hasError,
	isRevealed,
	onToggleRevealed,
}: DoorPinSectionProps): JSX.Element {
	if (isLoading) {
		return (
			<SkeletonRegion label="Loading your door PIN">
				<Skeleton className="h-12 w-48 rounded-lg" />
			</SkeletonRegion>
		);
	}

	if (hasError || !doorPin) {
		return (
			<InfoBox variant="destructive" className="text-sm">
				Your door PIN couldn't be loaded. Reload the page to try again.
			</InfoBox>
		);
	}

	if (doorPin.status === "welcome_required") {
		return (
			<InfoBox
				variant="brand"
				className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
			>
				<p>Finish your welcome steps to see your door PIN.</p>
				<Button asChild size="sm" variant="outline">
					<Link to="/welcome">Go to welcome</Link>
				</Button>
			</InfoBox>
		);
	}

	if (doorPin.status === "not_assigned") {
		return (
			<InfoBox className="text-sm text-muted-foreground">
				You don't have a door PIN yet. Ask the board if you need access to the
				office.
			</InfoBox>
		);
	}

	const pinId = `${DOOR_PIN_SECTION_ID}-value`;
	const labelId = `${DOOR_PIN_SECTION_ID}-label`;
	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="flex flex-col gap-1.5">
				<span
					id={labelId}
					className="text-xs font-medium text-muted-foreground"
				>
					Your PIN
				</span>
				<output
					id={pinId}
					aria-labelledby={labelId}
					aria-live="polite"
					className="rounded-lg border border-border bg-muted/30 px-4 py-2 font-mono text-2xl tracking-[0.35em] tabular-nums"
				>
					{isRevealed ? (
						doorPin.pin
					) : (
						<>
							<span aria-hidden="true">{"•".repeat(doorPin.pin.length)}</span>
							<span className="sr-only">Hidden</span>
						</>
					)}
				</output>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={onToggleRevealed}
				aria-pressed={isRevealed}
				aria-controls={pinId}
			>
				{isRevealed ? (
					<EyeOff className="size-4" aria-hidden="true" />
				) : (
					<Eye className="size-4" aria-hidden="true" />
				)}
				{isRevealed ? "Hide PIN" : "Show PIN"}
			</Button>
		</div>
	);
}
