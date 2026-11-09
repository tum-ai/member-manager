import { useSearchParams } from "react-router-dom";

export const MCP_ACCESS_TABS = ["notion", "dev"] as const;
export type McpAccessTab = (typeof MCP_ACCESS_TABS)[number];

/**
 * The open tab of /admin/mcp-access, kept in `?tab=` so dev-claude can link
 * straight to `?tab=dev`. Anything else opens the Notion tab.
 */
export function useMcpAccessTab() {
	const [params, setParams] = useSearchParams();
	const tab: McpAccessTab = params.get("tab") === "dev" ? "dev" : "notion";
	return {
		tab,
		setTab: (next: string) => {
			setParams(
				(current) => {
					const updated = new URLSearchParams(current);
					if (next === "dev") updated.set("tab", "dev");
					else updated.delete("tab");
					return updated;
				},
				{ replace: true },
			);
		},
	};
}
