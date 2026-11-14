import type {
	DevMcpAccessActionInput,
	DevMcpAccessEntry,
	DevMcpCatalog,
	DevMcpRole,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	describeSavedDevMcpAction,
	groupDevMcpAccess,
} from "@/features/admin/adminDevMcpAccessUtils";
import { apiClient } from "@/lib/apiClient";

export const adminDevMcpAccessQueryKey = ["admin", "dev-mcp-access"] as const;
export const adminDevMcpCatalogQueryKey = [
	"admin",
	"dev-mcp-access",
	"catalog",
] as const;

/** A suspend or deny waiting for the admin to confirm it. */
export interface DevMcpAccessConfirmation {
	entry: DevMcpAccessEntry;
	action: "suspend" | "deny";
}

interface ActionVariables {
	entry: DevMcpAccessEntry;
	action: DevMcpAccessActionInput;
}

/**
 * dev-mcp (Dev Claude's MCP server) access for the Dev tab of
 * /admin/mcp-access: the requests grouped by status, dev-mcp's tool catalog,
 * and the admin actions. Suspending and denying go through a confirmation;
 * tools are edited in a dialog. `enabled: false` loads nothing (another tab
 * is open).
 */
export function useAdminDevMcpAccess({ enabled = true } = {}) {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const [confirmation, setConfirmation] =
		useState<DevMcpAccessConfirmation | null>(null);
	const [editingTools, setEditingTools] = useState<DevMcpAccessEntry | null>(
		null,
	);

	const query = useQuery({
		queryKey: adminDevMcpAccessQueryKey,
		queryFn: () => apiClient<DevMcpAccessEntry[]>("/api/admin/dev-mcp-access"),
		enabled,
	});

	// Comes from dev-mcp; approving and changing roles or tools need it.
	const catalogQuery = useQuery({
		queryKey: adminDevMcpCatalogQueryKey,
		queryFn: () =>
			apiClient<DevMcpCatalog>("/api/admin/dev-mcp-access/catalog"),
		enabled,
		staleTime: 60_000,
		retry: false,
	});

	const mutation = useMutation({
		mutationFn: ({ entry, action }: ActionVariables) =>
			apiClient<DevMcpAccessEntry>(
				`/api/admin/dev-mcp-access/${encodeURIComponent(entry.user_id)}`,
				{ method: "PATCH", body: JSON.stringify(action) },
			),
		onSuccess: (_saved, { entry, action }) => {
			showToast(describeSavedDevMcpAction(entry, action), "success");
		},
		onError: (error) => {
			showToast(
				`Couldn't update Dev MCP access: ${error instanceof Error ? error.message : "unknown error"}`,
				"error",
			);
		},
		// Reload either way: a conflict means another admin acted first.
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: adminDevMcpAccessQueryKey }),
	});

	const act = (entry: DevMcpAccessEntry, action: DevMcpAccessActionInput) =>
		mutation.mutate({ entry, action });

	return {
		...groupDevMcpAccess(query.data ?? []),
		isLoading: enabled && query.isPending,
		error: query.error ?? null,
		catalog: catalogQuery.data?.tools ?? [],
		catalogError: catalogQuery.error ?? null,
		busyUserId: mutation.isPending
			? (mutation.variables?.entry.user_id ?? null)
			: null,
		/** Approves a request, or a suspended or denied member again. */
		approve: (entry: DevMcpAccessEntry, role: DevMcpRole) =>
			act(entry, {
				action: entry.status === "requested" ? "approve" : "reapprove",
				role,
			}),
		setRole: (entry: DevMcpAccessEntry, role: DevMcpRole) =>
			act(entry, { action: "set_role", role }),
		requestSuspend: (entry: DevMcpAccessEntry) =>
			setConfirmation({ entry, action: "suspend" }),
		requestDeny: (entry: DevMcpAccessEntry) =>
			setConfirmation({ entry, action: "deny" }),
		confirmation,
		cancelConfirmation: () => setConfirmation(null),
		confirm: (note: string) => {
			if (confirmation) {
				act(confirmation.entry, { action: confirmation.action, note });
			}
			setConfirmation(null);
		},
		editingTools,
		editTools: setEditingTools,
		cancelEditTools: () => setEditingTools(null),
		saveTools: (tools: string[]) => {
			if (editingTools) {
				act(editingTools, { action: "set_tools", tools });
			}
			setEditingTools(null);
		},
	};
}

export type AdminDevMcpAccess = ReturnType<typeof useAdminDevMcpAccess>;
