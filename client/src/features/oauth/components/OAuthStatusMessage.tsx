import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoBox } from "@/components/ui/info-box";
import { Spinner } from "@/components/ui/spinner";
import type { OAuthConsentState } from "@/features/oauth/hooks/useOAuthConsent";

const START_AGAIN = "Start connecting again from your AI app.";

/** Every consent-page state except the consent form itself. */
export function OAuthStatusMessage({
	state,
}: {
	state: Exclude<OAuthConsentState, { status: "consent" }>;
}): JSX.Element {
	switch (state.status) {
		case "loading":
		case "redirecting": {
			const label =
				state.status === "loading"
					? "Loading the request…"
					: "Taking you back to the app…";
			return (
				<div className="flex items-center gap-3 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
					<Spinner aria-label={label} />
					<span>{label}</span>
				</div>
			);
		}
		case "missing-request":
			return (
				<Alert variant="destructive">
					<AlertTitle>This link is incomplete</AlertTitle>
					<AlertDescription>
						It doesn't say which app wants access. {START_AGAIN}
					</AlertDescription>
				</Alert>
			);
		case "refused":
			return (
				<Alert variant="destructive">
					<AlertTitle>This app isn't an approved TUM.ai MCP client</AlertTitle>
					<AlertDescription>
						<p>
							It wanted to send you to {state.redirectLabel}, so you weren't
							sent back and nothing was shared. If you need this app, ask the
							dev team to add it.
						</p>
					</AlertDescription>
				</Alert>
			);
		case "unbound":
			return (
				<Alert variant="destructive">
					<AlertTitle>This app can't connect to this TUM.ai server</AlertTitle>
					<AlertDescription>
						<p>{state.message}</p>
						<p>You weren't sent back, and nothing was shared.</p>
					</AlertDescription>
				</Alert>
			);
		case "denied":
			return (
				<InfoBox variant="card" className="p-6 text-sm" role="status">
					You denied access. Nothing was shared with this app, and you can close
					this tab.
				</InfoBox>
			);
		case "error":
			return (
				<Alert variant="destructive">
					<AlertTitle>This request can't be used</AlertTitle>
					<AlertDescription>
						<p>It may have expired or been answered already. {START_AGAIN}</p>
						{state.message ? (
							<p className="text-xs">Details: {state.message}</p>
						) : null}
					</AlertDescription>
				</Alert>
			);
	}
}
