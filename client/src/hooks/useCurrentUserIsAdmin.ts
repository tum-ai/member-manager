import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useIsAdmin } from "./useIsAdmin";

export function useCurrentUserIsAdmin(): {
	currentUserId: string | null;
	isAdmin: boolean;
	isLoading: boolean;
} {
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [isSessionLoading, setIsSessionLoading] = useState(true);
	const { isAdmin, isLoading: isAdminLoading } = useIsAdmin(
		currentUserId ?? undefined,
	);

	useEffect(() => {
		let cancelled = false;
		supabase.auth
			.getSession()
			.then(({ data: { session } }) => {
				if (!cancelled) setCurrentUserId(session?.user.id ?? null);
			})
			.catch((error) => {
				console.error("Failed to fetch current session:", error);
			})
			.finally(() => {
				if (!cancelled) setIsSessionLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return {
		currentUserId,
		isAdmin,
		isLoading: isSessionLoading || isAdminLoading,
	};
}
