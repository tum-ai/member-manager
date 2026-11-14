import type { OwnDevMcpAccess } from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export const ownDevMcpAccessQueryKey = ["dev-mcp-access", "me"] as const;

/** The member's own dev-mcp (Dev Claude's MCP) access, for /connected-apps. */
export function useOwnDevMcpAccess() {
	const query = useQuery({
		queryKey: ownDevMcpAccessQueryKey,
		queryFn: () => apiClient<OwnDevMcpAccess>("/api/dev-mcp-access/me"),
	});
	return {
		access: query.data ?? null,
		isLoading: query.isPending,
		hasError: query.isError,
	};
}
