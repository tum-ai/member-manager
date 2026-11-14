import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
	/** Chosen by whoever registered the app, so never the main detail. */
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

/**
 * The consent form. Where the app sends the member is its most prominent
 * detail: apps name themselves, but the code only ever goes to that address.
 * An app that isn't an approved MCP client can only be denied.
 */
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
	const { isApproved, label } = redirectTarget;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 className="text-lg leading-snug">
						{isApproved
							? "Allow this app to act as you on a TUM.ai MCP server?"
							: "This app isn't an approved TUM.ai MCP client"}
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
				<InfoBox
					variant={isApproved ? "brand" : "destructive"}
					className="space-y-1 p-4"
				>
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						Sends you back to
					</p>
					<p
						className="text-xl font-semibold break-all"
						data-testid="oauth-redirect-target"
					>
						{label}
					</p>
					<p
						className={
							isApproved
								? "flex items-center gap-1.5 font-medium text-brand"
								: "flex items-center gap-1.5 font-medium text-destructive"
						}
					>
						{isApproved ? (
							<ShieldCheck className="size-4 shrink-0" aria-hidden />
						) : (
							<TriangleAlert className="size-4 shrink-0" aria-hidden />
						)}
						{isApproved
							? "Approved TUM.ai MCP client"
							: "Not an approved MCP client"}
					</p>
					<p className="text-muted-foreground">
						The app calls itself “{clientName}”. Any app can choose any name, so
						go by the address above.
					</p>
				</InfoBox>

				{isApproved ? (
					<>
						<p>
							If you approve, this app can act as you on the TUM.ai MCP server
							you are connecting it to: the Notion MCP (nomcp), which reads and
							edits TUM.ai's Notion workspace, or Dev MCP, Dev Claude's tools
							for mailboxes, GitHub invites and Notion pages. It gets only what
							an admin approved for you there, and every action is logged under
							your name.
						</p>
						<p className="text-muted-foreground">
							Each app connects to one TUM.ai server. To use both, add the app
							once for each.
						</p>
						<p className="font-semibold">
							Approve only if you just connected this app yourself.
						</p>
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
					</>
				) : (
					<Alert variant="destructive">
						<AlertTitle>Approving is turned off for this app</AlertTitle>
						<AlertDescription>
							Only the MCP clients TUM.ai supports can connect to your account,
							and this app sends you to {label}. If you need it, ask the dev
							team to add it. If you didn't start connecting an app just now,
							deny it.
						</AlertDescription>
					</Alert>
				)}

				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
			</CardContent>

			<CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button
					variant={isApproved ? "outline" : "default"}
					className="w-full sm:w-auto"
					onClick={onDeny}
					disabled={isPending}
				>
					{pendingDecision === "deny" ? <Spinner /> : null}
					Deny
				</Button>
				{isApproved ? (
					<Button
						className="w-full sm:w-auto"
						onClick={onApprove}
						disabled={isPending}
					>
						{pendingDecision === "approve" ? <Spinner /> : null}
						Approve
					</Button>
				) : null}
			</CardFooter>
		</Card>
	);
}
