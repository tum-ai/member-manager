import {
	type ClaimFieldInput,
	type ClaimStatus,
	type ClaimType,
	expertiseProfileSchema,
	type ProfilePatch,
	profilePatchSchema,
	tagVocabularyResponseSchema,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expertiseQueryKeys } from "@/features/expertise/expertiseQueryKeys";
import { apiClient } from "@/lib/apiClient";

interface ClaimMutationInput {
	type: ClaimType;
	id?: string;
	body: ClaimFieldInput | { status: ClaimStatus };
}

/** Owns validated Beacon profile queries and all profile mutations. */
export function useExpertiseData(userId: string) {
	const queryClient = useQueryClient();
	const profileQuery = useQuery({
		queryKey: expertiseQueryKeys.profile(userId),
		queryFn: async () =>
			expertiseProfileSchema.parse(
				await apiClient<unknown>(`/api/expertise/${userId}`, { method: "GET" }),
			),
		enabled: Boolean(userId),
	});
	const tagsQuery = useQuery({
		queryKey: expertiseQueryKeys.tags(),
		queryFn: async () =>
			tagVocabularyResponseSchema.parse(
				await apiClient<unknown>("/api/expertise/meta/tags", { method: "GET" }),
			).tags,
		staleTime: 1000 * 60 * 30,
	});

	const invalidateProfile = () =>
		queryClient.invalidateQueries({
			queryKey: expertiseQueryKeys.profile(userId),
		});

	const saveProfile = useMutation({
		mutationFn: async (body: ProfilePatch) => {
			const parsed = profilePatchSchema.parse(body);
			return apiClient(`/api/expertise/${userId}`, {
				method: "PUT",
				body: JSON.stringify(parsed),
			});
		},
		onSuccess: invalidateProfile,
	});
	const setOptOut = useMutation({
		mutationFn: async (optedOut: boolean) =>
			apiClient(`/api/expertise/${userId}/opt-out`, {
				method: "POST",
				body: JSON.stringify({ opted_out: optedOut }),
			}),
		onSuccess: invalidateProfile,
	});
	const addClaim = useMutation({
		mutationFn: async ({ type, body }: ClaimMutationInput) =>
			apiClient(`/api/expertise/${userId}/claims/${type}`, {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: invalidateProfile,
	});
	const patchClaim = useMutation({
		mutationFn: async ({ type, id, body }: ClaimMutationInput) => {
			if (!id) throw new Error("A claim id is required");
			return apiClient(`/api/expertise/${userId}/claims/${type}/${id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			});
		},
		onSuccess: invalidateProfile,
	});
	const deleteClaim = useMutation({
		mutationFn: async ({
			type,
			id,
		}: Pick<ClaimMutationInput, "type" | "id">) => {
			if (!id) throw new Error("A claim id is required");
			return apiClient(`/api/expertise/${userId}/claims/${type}/${id}`, {
				method: "DELETE",
			});
		},
		onSuccess: invalidateProfile,
	});

	return {
		profileQuery,
		tagsQuery,
		saveProfile,
		setOptOut,
		addClaim,
		patchClaim,
		deleteClaim,
	};
}
