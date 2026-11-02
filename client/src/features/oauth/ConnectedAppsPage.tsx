import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { ConnectedAppsPanel } from "./components/ConnectedAppsPanel";
import { NotionMcpAccessStatus } from "./components/NotionMcpAccessStatus";
import { useConnectedApps } from "./hooks/useConnectedApps";
import { useOwnMcpAccess } from "./hooks/useOwnMcpAccess";

/**
 * `/connected-apps`: the member's nomcp access status and the apps they
 * approved, e.g. AI agents using nomcp.
 */
export default function ConnectedAppsPage(): JSX.Element {
	const {
		apps,
		isLoading,
		hasError,
		appToRevoke,
		requestRevoke,
		cancelRevoke,
		confirmRevoke,
		revokingClientId,
	} = useConnectedApps();
	const mcpAccess = useOwnMcpAccess();

	return (
		<ToolPageShell
			title="Connected apps"
			description="Apps you allowed to use your TUM.ai account, such as AI agents working in the TUM.ai Notion. Disconnect one to take its access away."
		>
			<div className="max-w-2xl space-y-4">
				<NotionMcpAccessStatus
					access={mcpAccess.access}
					isLoading={mcpAccess.isLoading}
					hasError={mcpAccess.hasError}
				/>
				<ConnectedAppsPanel
					apps={apps}
					isLoading={isLoading}
					hasError={hasError}
					appToRevoke={appToRevoke}
					revokingClientId={revokingClientId}
					onRequestRevoke={requestRevoke}
					onCancelRevoke={cancelRevoke}
					onConfirmRevoke={confirmRevoke}
				/>
			</div>
		</ToolPageShell>
	);
}
