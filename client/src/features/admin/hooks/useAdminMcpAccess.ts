import type {
	McpAccessDecisionInput,
	McpAccessEntry,
	McpAccessRole,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	describeSavedDecision,
	groupMcpAccess,
} from "@/features/admin/adminMcpAccessUtils";
import { apiClient } from "@/lib/apiClient";

export const adminMcpAccessQueryKey = ["admin", "mcp-access"] as const;

/** A deny or revoke waiting for the admin to confirm it. */
export interface McpAccessConfirmation {
	entry: McpAccessEntry;
	action: "deny" | "revoke";
}

interface DecisionVariables {
	entry: McpAccessEntry;
	decision: McpAccessDecisionInput;
}

/**
 * nomcp (TUM.ai Notion MCP) access requests for the admin page, grouped by
 * status, and the decisions on them. Denying and revoking go through a
 * confirmation first.
 */
export function useAdminMcpAccess() {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const [confirmation, setConfirmation] =
		useState<McpAccessConfirmation | null>(null);

	const query = useQuery({
		queryKey: adminMcpAccessQueryKey,
		queryFn: () => apiClient<McpAccessEntry[]>("/api/admin/mcp-access"),
	});

	const mutation = useMutation({
		mutationFn: ({ entry, decision }: DecisionVariables) =>
			apiClient<McpAccessEntry>(
				`/api/admin/mcp-access/${encodeURIComponent(entry.user_id)}`,
				{ method: "PATCH", body: JSON.stringify(decision) },
			),
		onSuccess: (_saved, { entry, decision }) => {
			showToast(describeSavedDecision(entry, decision), "success");
		},
		onError: (error) => {
			showToast(
				`Couldn't update Notion MCP access: ${error instanceof Error ? error.message : "unknown error"}`,
				"error",
			);
		},
		// Reload either way: a conflict means another admin decided first.
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: adminMcpAccessQueryKey }),
	});

	const decide = (entry: McpAccessEntry, decision: McpAccessDecisionInput) =>
		mutation.mutate({ entry, decision });

	return {
		...groupMcpAccess(query.data ?? []),
		isLoading: query.isPending,
		error: query.error ?? null,
		busyUserId: mutation.isPending
			? (mutation.variables?.entry.user_id ?? null)
			: null,
		approve: (entry: McpAccessEntry, role: McpAccessRole) =>
			decide(entry, { action: "approve", role }),
		setRole: (entry: McpAccessEntry, role: McpAccessRole) =>
			decide(entry, { action: "set_role", role }),
		requestDeny: (entry: McpAccessEntry) =>
			setConfirmation({ entry, action: "deny" }),
		requestRevoke: (entry: McpAccessEntry) =>
			setConfirmation({ entry, action: "revoke" }),
		confirmation,
		cancelConfirmation: () => setConfirmation(null),
		confirm: (note: string) => {
			if (confirmation) {
				decide(confirmation.entry, { action: confirmation.action, note });
			}
			setConfirmation(null);
		},
	};
}
