import { TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InfoBox } from "@/components/ui/info-box";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import type { ConsentDecision } from "@/features/oauth/oauthApi";
import {
	CONNECTED_APPS_PATH,
	describeScope,
	type RedirectTarget,
} from "@/features/oauth/oauthUtils";

export interface OAuthConsentCardProps {
	clientName: string;
	redirectTarget: RedirectTarget;
	scopes: string[];
	userEmail: string | null;
	pendingDecision: ConsentDecision | null;
	error: string | null;
	onApprove: () => void;
	onDeny: () => void;
	onSwitchAccount: () => void;
}

export function OAuthConsentCard({
	clientName,
	redirectTarget,
	scopes,
	userEmail,
	pendingDecision,
	error,
	onApprove,
	onDeny,
	onSwitchAccount,
}: OAuthConsentCardProps): JSX.Element {
	const isPending = pendingDecision !== null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 className="text-lg leading-snug">
						Allow {clientName} to use your TUM.ai account?
					</h2>
				</CardTitle>
				{userEmail ? (
					<CardDescription>
						Signed in as {userEmail}.{" "}
						<LinkButton onClick={onSwitchAccount} disabled={isPending}>
							Use a different account
						</LinkButton>
					</CardDescription>
				) : null}
			</CardHeader>

			<CardContent className="space-y-4 text-sm">
				<p>
					<strong>{clientName}</strong> will be able to read and edit the TUM.ai
					Notion workspace as you through the TUM.ai Notion MCP (nomcp). Every
					action is logged under your name.
				</p>

				<dl className="grid gap-1">
					<dt className="text-muted-foreground">Sends you back to</dt>
					<dd className="font-medium break-all">{redirectTarget.label}</dd>
				</dl>
				{redirectTarget.isKnownApp ? null : (
					<InfoBox
						variant="destructive"
						className="flex gap-2 text-destructive"
						data-testid="oauth-unknown-redirect"
					>
						<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
						<p>
							{redirectTarget.label} isn't a site we know for AI apps. Only
							continue if you started connecting {clientName} yourself just now.
						</p>
					</InfoBox>
				)}

				{scopes.length > 0 ? (
					<div className="space-y-1">
						<p className="text-muted-foreground">It also gets to:</p>
						<ul className="list-disc space-y-0.5 pl-5">
							{scopes.map((scope) => (
								<li key={scope}>{describeScope(scope)}</li>
							))}
						</ul>
					</div>
				) : null}

				<p className="text-muted-foreground">
					You can disconnect it at any time under{" "}
					<Link
						to={CONNECTED_APPS_PATH}
						className="text-brand underline-offset-4 hover:underline"
					>
						Connected apps
					</Link>
					.
				</p>

				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
			</CardContent>

			<CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button
					variant="outline"
					className="w-full sm:w-auto"
					onClick={onDeny}
					disabled={isPending}
				>
					{pendingDecision === "deny" ? <Spinner /> : null}
					Deny
				</Button>
				<Button
					className="w-full sm:w-auto"
					onClick={onApprove}
					disabled={isPending}
				>
					{pendingDecision === "approve" ? <Spinner /> : null}
					Approve
				</Button>
			</CardFooter>
		</Card>
	);
}
