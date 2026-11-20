import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Saving without a loaded profile would overwrite it blindly, so there is no form. */
export function ProfileLoadError({
	message,
}: {
	message: string;
}): JSX.Element {
	return (
		<Alert variant="destructive" role="alert">
			<AlertTitle>We couldn't load your profile</AlertTitle>
			<AlertDescription>
				{message}. Reload the page to try again.
			</AlertDescription>
		</Alert>
	);
}
