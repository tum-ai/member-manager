import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	type ConnectedApp,
	fetchConnectedApps,
	oauthQueryKeys,
	revokeConnectedApp,
} from "@/features/oauth/oauthApi";

/** The apps the member approved through the consent page, and revoking them. */
export function useConnectedApps() {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const [appToRevoke, setAppToRevoke] = useState<ConnectedApp | null>(null);

	const appsQuery = useQuery({
		queryKey: oauthQueryKeys.connectedApps,
		queryFn: fetchConnectedApps,
	});

	const revokeMutation = useMutation({
		mutationFn: (app: ConnectedApp) => revokeConnectedApp(app.clientId),
		onSuccess: (_data, app) => {
			showToast(`${app.name} was disconnected.`, "success");
			void queryClient.invalidateQueries({
				queryKey: oauthQueryKeys.connectedApps,
			});
		},
		onError: (error, app) => {
			showToast(
				`Couldn't disconnect ${app.name}: ${error instanceof Error ? error.message : "unknown error"}`,
				"error",
			);
		},
	});

	return {
		apps: appsQuery.data ?? [],
		isLoading: appsQuery.isPending,
		hasError: appsQuery.isError,
		appToRevoke,
		requestRevoke: setAppToRevoke,
		cancelRevoke: () => setAppToRevoke(null),
		confirmRevoke: () => {
			if (appToRevoke) revokeMutation.mutate(appToRevoke);
			setAppToRevoke(null);
		},
		revokingClientId: revokeMutation.isPending
			? (revokeMutation.variables?.clientId ?? null)
			: null,
	};
}
