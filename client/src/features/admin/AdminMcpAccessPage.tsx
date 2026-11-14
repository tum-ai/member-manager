import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import { DevMcpAccessPanel } from "./components/DevMcpAccessPanel";
import { NotionMcpAccessPanel } from "./components/NotionMcpAccessPanel";
import { useAdminDevMcpAccess } from "./hooks/useAdminDevMcpAccess";
import { useAdminMcpAccess } from "./hooks/useAdminMcpAccess";
import { useMcpAccessTab } from "./hooks/useMcpAccessTab";

/**
 * `/admin/mcp-access`: who may use TUM.ai's MCP servers. The Notion tab is
 * nomcp (the TUM.ai Notion MCP), the Dev tab (`?tab=dev`) dev-mcp (Dev Claude
 * and directly connected AI apps). The Dev tab loads only once it is open.
 */
export default function AdminMcpAccessPage(): JSX.Element {
	const { tab, setTab } = useMcpAccessTab();
	const notion = useAdminMcpAccess();
	const dev = useAdminDevMcpAccess({ enabled: tab === "dev" });

	return (
		<AdminRequestsLayout
			title="MCP access"
			description="Decide who can use TUM.ai's MCP servers from their AI apps: the Notion MCP (nomcp) and Dev MCP (Dev Claude's tools). Members appear here when they first ask for access."
		>
			<Tabs value={tab} onValueChange={setTab} className="gap-6">
				<TabsList aria-label="MCP server">
					<TabsTrigger value="notion">Notion</TabsTrigger>
					<TabsTrigger value="dev">Dev</TabsTrigger>
				</TabsList>
				<TabsContent value="notion">
					<NotionMcpAccessPanel access={notion} />
				</TabsContent>
				<TabsContent value="dev">
					<DevMcpAccessPanel access={dev} />
				</TabsContent>
			</Tabs>
		</AdminRequestsLayout>
	);
}
