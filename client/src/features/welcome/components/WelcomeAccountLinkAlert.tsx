import { Link2 } from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const ACCOUNT_SUPPORT_EMAIL = "contact@tum-ai.com";

/**
 * Shown when the signed-in account has no member record behind it, which
 * happens when the Slack email differs from the email TUM.ai has on file and
 * the first Slack login created a new account. The member can still give
 * consent and upload a CV here; an admin merges this account into the
 * existing one afterwards (`merge_duplicate_member` carries both over). The
 * duplicate finder can't match a nameless account, so the member's message
 * with their application email is how admins find it.
 */
export function WelcomeAccountLinkAlert(): ReactElement {
	return (
		<Alert>
			<Link2 aria-hidden="true" />
			<AlertTitle>
				Your Slack account isn't linked to your membership yet
			</AlertTitle>
			<AlertDescription>
				<p>
					This usually means Slack uses a different email than the one you
					applied with. You can still give your consent and upload your CV
					below. Write to{" "}
					<a
						href={`mailto:${ACCOUNT_SUPPORT_EMAIL}`}
						className="text-brand underline underline-offset-2"
					>
						{ACCOUNT_SUPPORT_EMAIL}
					</a>{" "}
					with the email you applied with, and we'll merge both accounts.
				</p>
			</AlertDescription>
		</Alert>
	);
}
