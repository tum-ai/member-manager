import { OAuthConsentCard } from "./components/OAuthConsentCard";
import { OAuthPageShell } from "./components/OAuthPageShell";
import { OAuthStatusMessage } from "./components/OAuthStatusMessage";
import {
	type UseOAuthConsentOptions,
	useOAuthConsent,
} from "./hooks/useOAuthConsent";

/**
 * `/oauth/consent`: Supabase's OAuth server sends a signed-in member here to
 * approve or deny an app (an AI agent connecting to nomcp). `AppRouter`
 * renders it outside the app shell and the /welcome gate.
 */
export default function OAuthConsentPage(
	props: UseOAuthConsentOptions = {},
): JSX.Element {
	const {
		state,
		pendingDecision,
		decisionError,
		approve,
		deny,
		switchAccount,
	} = useOAuthConsent(props);

	return (
		<OAuthPageShell>
			{state.status === "consent" ? (
				<OAuthConsentCard
					clientName={state.request.clientName}
					redirectTarget={state.redirectTarget}
					scopes={state.request.scopes}
					userEmail={state.request.userEmail}
					pendingDecision={pendingDecision}
					error={decisionError}
					onApprove={approve}
					onDeny={deny}
					onSwitchAccount={switchAccount}
				/>
			) : (
				<OAuthStatusMessage state={state} />
			)}
		</OAuthPageShell>
	);
}
