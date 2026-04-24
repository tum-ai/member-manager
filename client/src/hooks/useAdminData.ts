import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminMember } from "../features/admin/adminUtils";
import { apiClient } from "../lib/apiClient";

interface AdminResponse {
	data: AdminMember[];
	total: number;
	page: number;
	limit: number;
}

export interface MemberChangeRequest {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	reason?: string | null;
	review_note?: string | null;
	changes: {
		department?: string | null;
		member_role?: string | null;
		degree?: string | null;
		school?: string | null;
		batch?: string | null;
	};
}

export interface EngagementCertificateRequest {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	review_note?: string | null;
	engagements: Array<Record<string, unknown>>;
}

export function useAdminData() {
	const queryClient = useQueryClient();

	const {
		data: members,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["admin-members"],
		queryFn: async () => {
			const response = await apiClient<AdminResponse>(
				"/api/admin/members?limit=1000",
			);
			return response.data;
		},
	});

	const {
		data: changeRequests,
		isLoading: isLoadingChangeRequests,
		error: changeRequestsError,
	} = useQuery({
		queryKey: ["admin-member-change-requests"],
		queryFn: async () => {
			return await apiClient<MemberChangeRequest[]>(
				"/api/admin/member-change-requests",
			);
		},
	});

	const {
		data: certificateRequests,
		isLoading: isLoadingCertificateRequests,
		error: certificateRequestsError,
	} = useQuery({
		queryKey: ["admin-engagement-certificate-requests"],
		queryFn: async () => {
			return await apiClient<EngagementCertificateRequest[]>(
				"/api/admin/engagement-certificate-requests",
			);
		},
	});

	const updateDepartmentMutation = useMutation({
		mutationFn: async ({
			userId,
			department,
		}: {
			userId: string;
			department: string | null;
		}) => {
			await apiClient(`/api/admin/members/${userId}/department`, {
				method: "PATCH",
				body: JSON.stringify({ department }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		},
	});

	const updateRoleMutation = useMutation({
		mutationFn: async ({
			userId,
			member_role,
		}: {
			userId: string;
			member_role: string;
		}) => {
			await apiClient(`/api/admin/members/${userId}/role`, {
				method: "PATCH",
				body: JSON.stringify({ member_role }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		},
	});

	const updateStatusMutation = useMutation({
		mutationFn: async ({
			userId,
			member_status,
		}: {
			userId: string;
			member_status: string;
		}) => {
			await apiClient(`/api/admin/members/${userId}/status`, {
				method: "PATCH",
				body: JSON.stringify({ member_status }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		},
	});

	const updateAccessRoleMutation = useMutation({
		mutationFn: async ({
			userId,
			access_role,
		}: {
			userId: string;
			access_role: "user" | "admin";
		}) => {
			await apiClient(`/api/admin/members/${userId}/access-role`, {
				method: "PATCH",
				body: JSON.stringify({ access_role }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		},
	});

	const reviewChangeRequestMutation = useMutation({
		mutationFn: async ({
			requestId,
			decision,
			review_note,
		}: {
			requestId: string;
			decision: "approved" | "rejected";
			review_note?: string;
		}) => {
			await apiClient(`/api/admin/member-change-requests/${requestId}`, {
				method: "PATCH",
				body: JSON.stringify({ decision, review_note }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["admin-member-change-requests"],
			});
			queryClient.invalidateQueries({ queryKey: ["admin-members"] });
			queryClient.invalidateQueries({ queryKey: ["member"] });
		},
	});

	const reviewCertificateRequestMutation = useMutation({
		mutationFn: async ({
			requestId,
			decision,
			review_note,
		}: {
			requestId: string;
			decision: "approved" | "rejected";
			review_note?: string;
		}) => {
			await apiClient(
				`/api/admin/engagement-certificate-requests/${requestId}`,
				{
					method: "PATCH",
					body: JSON.stringify({ decision, review_note }),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["admin-engagement-certificate-requests"],
			});
			queryClient.invalidateQueries({
				queryKey: ["engagement-certificate-requests"],
			});
		},
	});

	return {
		members,
		changeRequests: changeRequests ?? [],
		certificateRequests: certificateRequests ?? [],
		isLoading:
			isLoading || isLoadingChangeRequests || isLoadingCertificateRequests,
		error: error || changeRequestsError || certificateRequestsError,
		updateDepartmentAsync: updateDepartmentMutation.mutateAsync,
		updateRoleAsync: updateRoleMutation.mutateAsync,
		updateStatusAsync: updateStatusMutation.mutateAsync,
		updateAccessRoleAsync: updateAccessRoleMutation.mutateAsync,
		reviewChangeRequestAsync: reviewChangeRequestMutation.mutateAsync,
		reviewCertificateRequestAsync: reviewCertificateRequestMutation.mutateAsync,
		isSavingMember:
			updateDepartmentMutation.isPending ||
			updateRoleMutation.isPending ||
			updateStatusMutation.isPending ||
			updateAccessRoleMutation.isPending,
		isReviewingChangeRequest: reviewChangeRequestMutation.isPending,
		isReviewingCertificateRequest: reviewCertificateRequestMutation.isPending,
	};
}
