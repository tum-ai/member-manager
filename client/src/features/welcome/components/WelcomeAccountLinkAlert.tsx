import { UserX } from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const ACCOUNT_SUPPORT_EMAIL = "contact@tum-ai.com";

/**
 * Shown when the signed-in account has no member record behind it, which
 * happens when the Slack email differs from the email TUM.ai has on file.
 * Consent and CV are withheld so they can't land on the wrong account.
 */
export function WelcomeAccountLinkAlert(): ReactElement {
	return (
		<Alert>
			<UserX aria-hidden="true" />
			<AlertTitle>We couldn't find your member record</AlertTitle>
			<AlertDescription>
				<p>
					Your Slack account isn't linked to a TUM.ai membership yet, usually
					because Slack uses a different email than the one you applied with.
					Write to{" "}
					<a
						href={`mailto:${ACCOUNT_SUPPORT_EMAIL}`}
						className="text-brand underline underline-offset-2"
					>
						{ACCOUNT_SUPPORT_EMAIL}
					</a>{" "}
					with both email addresses and we'll connect them.
				</p>
			</AlertDescription>
		</Alert>
	);
}
