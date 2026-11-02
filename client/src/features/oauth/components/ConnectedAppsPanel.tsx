import { Unplug } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InfoBox } from "@/components/ui/info-box";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Spinner } from "@/components/ui/spinner";
import type { ConnectedApp } from "@/features/oauth/oauthApi";
import { describeScope, formatGrantedAt } from "@/features/oauth/oauthUtils";

export interface ConnectedAppsPanelProps {
	apps: ConnectedApp[];
	isLoading: boolean;
	hasError: boolean;
	appToRevoke: ConnectedApp | null;
	revokingClientId: string | null;
	onRequestRevoke: (app: ConnectedApp) => void;
	onCancelRevoke: () => void;
	onConfirmRevoke: () => void;
}

export function ConnectedAppsPanel({
	apps,
	isLoading,
	hasError,
	appToRevoke,
	revokingClientId,
	onRequestRevoke,
	onCancelRevoke,
	onConfirmRevoke,
}: ConnectedAppsPanelProps): JSX.Element {
	if (isLoading) {
		return (
			<SkeletonRegion label="Loading connected apps" className="space-y-3">
				<Skeleton className="h-16 w-full rounded-xl" />
				<Skeleton className="h-16 w-full rounded-xl" />
			</SkeletonRegion>
		);
	}

	if (hasError) {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					Connected apps couldn't be loaded. Try again later.
				</AlertDescription>
			</Alert>
		);
	}

	if (apps.length === 0) {
		return (
			<InfoBox className="p-6 text-center text-sm text-muted-foreground">
				No apps are connected to your account.
			</InfoBox>
		);
	}

	return (
		<>
			<ul className="space-y-3">
				{apps.map((app) => (
					<li
						key={app.clientId}
						className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="min-w-0">
							<p className="truncate font-medium">{app.name}</p>
							<p className="text-sm text-muted-foreground">
								Connected {formatGrantedAt(app.grantedAt)}
								{app.scopes.length > 0
									? ` · ${app.scopes.map(describeScope).join(", ")}`
									: null}
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onRequestRevoke(app)}
							disabled={revokingClientId !== null}
							aria-label={`Disconnect ${app.name}`}
						>
							{revokingClientId === app.clientId ? <Spinner /> : <Unplug />}
							Disconnect
						</Button>
					</li>
				))}
			</ul>
			<ConfirmDialog
				open={appToRevoke !== null}
				onOpenChange={(open) => {
					if (!open) onCancelRevoke();
				}}
				title={`Disconnect ${appToRevoke?.name ?? "this app"}?`}
				description="It loses access to your TUM.ai account within a minute. You can connect it again later."
				confirmLabel="Disconnect"
				destructive
				onConfirm={onConfirmRevoke}
			/>
		</>
	);
}
