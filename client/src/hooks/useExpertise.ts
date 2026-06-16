import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	ClaimType,
	ExpertiseProfile,
	TagVocabularyEntry,
} from "../features/expertise/types";
import { apiClient } from "../lib/apiClient";

export function useExpertise(userId: string) {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["expertise", userId],
		queryFn: async () =>
			(await apiClient(`/api/expertise/${userId}`, {
				method: "GET",
			})) as ExpertiseProfile,
		enabled: Boolean(userId),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["expertise", userId] });

	const saveProfile = useMutation({
		mutationFn: async (body: {
			headline?: string | null;
			summary?: string | null;
		}) =>
			apiClient(`/api/expertise/${userId}`, {
				method: "PUT",
				body: JSON.stringify(body),
			}),
		onSuccess: invalidate,
	});

	const setOptOut = useMutation({
		mutationFn: async (optedOut: boolean) =>
			apiClient(`/api/expertise/${userId}/opt-out`, {
				method: "POST",
				body: JSON.stringify({ opted_out: optedOut }),
			}),
		onSuccess: invalidate,
	});

	const addClaim = useMutation({
		mutationFn: async (args: {
			type: ClaimType;
			body: Record<string, unknown>;
		}) =>
			apiClient(`/api/expertise/${userId}/claims/${args.type}`, {
				method: "POST",
				body: JSON.stringify(args.body),
			}),
		onSuccess: invalidate,
	});

	const patchClaim = useMutation({
		mutationFn: async (args: {
			type: ClaimType;
			id: string;
			body: Record<string, unknown>;
		}) =>
			apiClient(`/api/expertise/${userId}/claims/${args.type}/${args.id}`, {
				method: "PATCH",
				body: JSON.stringify(args.body),
			}),
		onSuccess: invalidate,
	});

	const deleteClaim = useMutation({
		mutationFn: async (args: { type: ClaimType; id: string }) =>
			apiClient(`/api/expertise/${userId}/claims/${args.type}/${args.id}`, {
				method: "DELETE",
			}),
		onSuccess: invalidate,
	});

	return {
		profile: query.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
		saveProfileAsync: saveProfile.mutateAsync,
		isSavingProfile: saveProfile.isPending,
		setOptOutAsync: setOptOut.mutateAsync,
		isTogglingOptOut: setOptOut.isPending,
		addClaimAsync: addClaim.mutateAsync,
		isAddingClaim: addClaim.isPending,
		patchClaimAsync: patchClaim.mutateAsync,
		deleteClaimAsync: deleteClaim.mutateAsync,
	};
}

// Controlled capability-tag vocabulary (rarely changes → long stale time).
export function useExpertiseTags() {
	return useQuery({
		queryKey: ["expertise-tags"],
		queryFn: async () =>
			(
				(await apiClient("/api/expertise/meta/tags", {
					method: "GET",
				})) as { tags: TagVocabularyEntry[] }
			).tags,
		staleTime: 1000 * 60 * 30,
	});
}
