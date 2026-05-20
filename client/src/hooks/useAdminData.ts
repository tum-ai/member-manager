import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { AdminMember } from "../features/admin/adminUtils";
import { apiClient } from "../lib/apiClient";

interface AdminResponse {
	data: AdminMember[];
	total: number;
	page: number;
	limit: number;
}

const ADMIN_PAGE_SIZE = 200;

async function fetchAdminMembersPage(page: number): Promise<AdminResponse> {
	return await apiClient<AdminResponse>(
		`/api/admin/members?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
	);
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
		member_status?: string | null;
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

	const membersQuery = useInfiniteQuery({
		queryKey: ["admin-members"],
		queryFn: async ({ pageParam }) => fetchAdminMembersPage(pageParam),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const loadedThroughCurrentPage = lastPage.page * lastPage.limit;
			if (
				lastPage.data.length === 0 ||
				loadedThroughCurrentPage >= lastPage.total
			) {
				return undefined;
			}
			return lastPage.page + 1;
		},
	});

	// Render after the first admin page, then hydrate the rest in the background.
	// Previously the admin route waited for every member page before showing UI.
	useEffect(() => {
		if (membersQuery.hasNextPage && !membersQuery.isFetching) {
			void membersQuery.fetchNextPage();
		}
	}, [
		membersQuery.fetchNextPage,
		membersQuery.hasNextPage,
		membersQuery.isFetching,
	]);

	const members = useMemo(
		() => membersQuery.data?.pages.flatMap((page) => page.data),
		[membersQuery.data],
	);
	const totalMembers =
		membersQuery.data?.pages[0]?.total ?? members?.length ?? 0;

	const { data: changeRequests, error: changeRequestsError } = useQuery({
		queryKey: ["admin-member-change-requests"],
		queryFn: async () => {
			return await apiClient<MemberChangeRequest[]>(
				"/api/admin/member-change-requests",
			);
		},
	});

	const { data: certificateRequests, error: certificateRequestsError } =
		useQuery({
			queryKey: ["admin-engagement-certificate-requests"],
			queryFn: async () => {
				return await apiClient<EngagementCertificateRequest[]>(
					"/api/admin/engagement-certificate-requests",
				);
			},
		});

	function invalidateMemberViews() {
		queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		queryClient.invalidateQueries({ queryKey: ["members-list"] });
		queryClient.invalidateQueries({ queryKey: ["member"] });
	}

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
		onSuccess: invalidateMemberViews,
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
		onSuccess: invalidateMemberViews,
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
		onSuccess: invalidateMemberViews,
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
			invalidateMemberViews();
			queryClient.invalidateQueries({ queryKey: ["user-role"] });
		},
	});

	const updateMemberMutation = useMutation({
		mutationFn: async ({
			userId,
			department,
			member_role,
			board_role,
			member_status,
			access_role,
			linkedin_profile_id,
			linkedin_profile_url,
			public_location,
			current_company,
			current_position,
			professional_experience,
		}: {
			userId: string;
			department: string | null;
			member_role: string;
			board_role: string | null;
			member_status: string;
			access_role: "user" | "admin";
			linkedin_profile_id?: string | null;
			linkedin_profile_url?: string | null;
			public_location?: string | null;
			current_company?: string | null;
			current_position?: string | null;
			professional_experience?: string | null;
		}) => {
			await apiClient(`/api/admin/members/${userId}`, {
				method: "PATCH",
				body: JSON.stringify({
					department,
					member_role,
					board_role,
					member_status,
					access_role,
					linkedin_profile_id,
					linkedin_profile_url,
					public_location,
					current_company,
					current_position,
					professional_experience,
				}),
			});
		},
		onSuccess: () => {
			invalidateMemberViews();
			queryClient.invalidateQueries({ queryKey: ["user-role"] });
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
			invalidateMemberViews();
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
		totalMembers,
		changeRequests: changeRequests ?? [],
		certificateRequests: certificateRequests ?? [],
		isLoading: membersQuery.isLoading,
		isLoadingMoreMembers: membersQuery.isFetchingNextPage,
		isRefreshingMembers:
			membersQuery.isFetching && !membersQuery.isFetchingNextPage,
		error:
			membersQuery.error || changeRequestsError || certificateRequestsError,
		updateDepartmentAsync: updateDepartmentMutation.mutateAsync,
		updateRoleAsync: updateRoleMutation.mutateAsync,
		updateStatusAsync: updateStatusMutation.mutateAsync,
		updateAccessRoleAsync: updateAccessRoleMutation.mutateAsync,
		updateMemberAsync: updateMemberMutation.mutateAsync,
		reviewChangeRequestAsync: reviewChangeRequestMutation.mutateAsync,
		reviewCertificateRequestAsync: reviewCertificateRequestMutation.mutateAsync,
		isSavingMember:
			updateDepartmentMutation.isPending ||
			updateRoleMutation.isPending ||
			updateStatusMutation.isPending ||
			updateAccessRoleMutation.isPending ||
			updateMemberMutation.isPending,
		isReviewingChangeRequest: reviewChangeRequestMutation.isPending,
		isReviewingCertificateRequest: reviewCertificateRequestMutation.isPending,
	};
}
