import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const START_AGAIN = "Start connecting again from your AI app.";

/** Every consent-page state except the consent form itself. */
export function OAuthStatusMessage({
	status,
	message,
}: {
	status: "missing-request" | "loading" | "error" | "redirecting";
	message?: string;
}): JSX.Element {
	if (status === "loading" || status === "redirecting") {
		const label =
			status === "loading"
				? "Loading the request…"
				: "Taking you back to the app…";
		return (
			<div className="flex items-center gap-3 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
				<Spinner aria-label={label} />
				<span>{label}</span>
			</div>
		);
	}

	if (status === "missing-request") {
		return (
			<Alert variant="destructive">
				<AlertTitle>This link is incomplete</AlertTitle>
				<AlertDescription>
					It doesn't say which app wants access. {START_AGAIN}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Alert variant="destructive">
			<AlertTitle>This request can't be used</AlertTitle>
			<AlertDescription>
				<p>It may have expired or been answered already. {START_AGAIN}</p>
				{message ? <p className="text-xs">Details: {message}</p> : null}
			</AlertDescription>
		</Alert>
	);
}
