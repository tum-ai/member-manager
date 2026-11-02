import type { OwnMcpAccess } from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export const ownMcpAccessQueryKey = ["mcp-access", "me"] as const;

/** The member's own nomcp (TUM.ai Notion MCP) access, for /connected-apps. */
export function useOwnMcpAccess() {
	const query = useQuery({
		queryKey: ownMcpAccessQueryKey,
		queryFn: () => apiClient<OwnMcpAccess>("/api/mcp-access/me"),
	});
	return {
		access: query.data ?? null,
		isLoading: query.isPending,
		hasError: query.isError,
	};
}
