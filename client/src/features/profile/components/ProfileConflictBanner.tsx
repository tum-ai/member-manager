import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ProfileConflictBannerProps {
	onReloadLatest: () => void;
	onKeepMyChanges: () => void;
}

/**
 * Shown when a save was rejected because the profile changed elsewhere (a
 * second tab, an admin). The member's edits are still in the form; nothing is
 * resubmitted until they choose.
 */
export function ProfileConflictBanner({
	onReloadLatest,
	onKeepMyChanges,
}: ProfileConflictBannerProps): JSX.Element {
	return (
		<Alert variant="destructive" role="alert" className="lg:col-span-12">
			<TriangleAlert className="size-4" />
			<AlertTitle>Your profile was changed elsewhere</AlertTitle>
			<AlertDescription>
				<p>
					Nothing was saved. Keep your changes to review them on top of the
					latest version and save again, or discard them and load the latest
					version.
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button type="button" size="sm" onClick={onKeepMyChanges}>
						Keep my changes
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onReloadLatest}
					>
						Discard my changes and reload
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	);
}
