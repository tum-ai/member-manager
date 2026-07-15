import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type {
	AdminResponse,
	EngagementCertificateRequest,
	JobPostingRequest,
	MemberChangeRequest,
	MemberDuplicateCandidate,
	MemberMergeRequest,
	MemberMergeResponse,
} from "@/features/admin/adminTypes";
import { apiClient } from "@/lib/apiClient";

const ADMIN_PAGE_SIZE = 200;

async function fetchAdminMembersPage(page: number): Promise<AdminResponse> {
	return await apiClient<AdminResponse>(
		`/api/admin/members?page=${page}&limit=${ADMIN_PAGE_SIZE}`,
	);
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

	const { data: jobRequests, error: jobRequestsError } = useQuery({
		queryKey: ["admin-job-requests"],
		queryFn: async () => {
			return await apiClient<JobPostingRequest[]>("/api/admin/job-requests");
		},
	});

	const { data: duplicateCandidates, error: duplicateCandidatesError } =
		useQuery({
			queryKey: ["admin-member-duplicate-candidates"],
			retry: false,
			queryFn: async () => {
				const response = await apiClient<{ data: MemberDuplicateCandidate[] }>(
					"/api/admin/member-duplicate-candidates",
				);
				return response.data;
			},
		});

	function invalidateMemberViews() {
		queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		queryClient.invalidateQueries({ queryKey: ["members-list"] });
		queryClient.invalidateQueries({ queryKey: ["member"] });
		queryClient.invalidateQueries({
			queryKey: ["admin-member-duplicate-candidates"],
		});
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
			batch,
			research_project_id,
			linkedin_profile_url,
			public_location,
		}: {
			userId: string;
			department: string | null;
			member_role: string;
			board_role: string | null;
			member_status: string;
			access_role: "user" | "admin";
			batch?: string | null;
			research_project_id?: string | null;
			linkedin_profile_url?: string | null;
			public_location?: string | null;
		}) => {
			await apiClient(`/api/admin/members/${userId}`, {
				method: "PATCH",
				body: JSON.stringify({
					department,
					member_role,
					board_role,
					member_status,
					access_role,
					batch,
					research_project_id,
					linkedin_profile_url,
					public_location,
				}),
			});
		},
		onSuccess: () => {
			invalidateMemberViews();
			queryClient.invalidateQueries({ queryKey: ["user-role"] });
		},
	});

	const mergeMembersMutation = useMutation({
		mutationFn: async (request: MemberMergeRequest) => {
			return await apiClient<MemberMergeResponse>("/api/admin/members/merge", {
				method: "POST",
				body: JSON.stringify(request),
			});
		},
		onSuccess: () => {
			invalidateMemberViews();
			queryClient.invalidateQueries({
				queryKey: ["admin-member-change-requests"],
			});
			queryClient.invalidateQueries({
				queryKey: ["admin-engagement-certificate-requests"],
			});
			queryClient.invalidateQueries({ queryKey: ["admin-job-requests"] });
			queryClient.invalidateQueries({ queryKey: ["job-requests"] });
			queryClient.invalidateQueries({
				queryKey: ["engagement-certificate-requests"],
			});
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

	const reviewJobRequestMutation = useMutation({
		mutationFn: async ({
			requestId,
			decision,
			review_note,
		}: {
			requestId: string;
			decision: "approved" | "rejected";
			review_note?: string;
		}) => {
			await apiClient(`/api/admin/job-requests/${requestId}`, {
				method: "PATCH",
				body: JSON.stringify({ decision, review_note }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["admin-job-requests"],
			});
			queryClient.invalidateQueries({ queryKey: ["job-requests"] });
			queryClient.invalidateQueries({ queryKey: ["partner-jobs"] });
		},
	});

	const removeJobRequestMutation = useMutation({
		mutationFn: async (requestId: string) => {
			await apiClient(`/api/admin/job-requests/${requestId}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["admin-job-requests"],
			});
			queryClient.invalidateQueries({ queryKey: ["job-requests"] });
			queryClient.invalidateQueries({ queryKey: ["partner-jobs"] });
		},
	});

	return {
		members,
		totalMembers,
		changeRequests: changeRequests ?? [],
		certificateRequests: certificateRequests ?? [],
		jobRequests: jobRequests ?? [],
		duplicateCandidates: duplicateCandidates ?? [],
		duplicateCandidatesError,
		isLoading: membersQuery.isLoading,
		isLoadingMoreMembers: membersQuery.isFetchingNextPage,
		isRefreshingMembers:
			membersQuery.isFetching && !membersQuery.isFetchingNextPage,
		error:
			membersQuery.error ||
			changeRequestsError ||
			certificateRequestsError ||
			jobRequestsError,
		updateDepartmentAsync: updateDepartmentMutation.mutateAsync,
		updateRoleAsync: updateRoleMutation.mutateAsync,
		updateStatusAsync: updateStatusMutation.mutateAsync,
		updateAccessRoleAsync: updateAccessRoleMutation.mutateAsync,
		updateMemberAsync: updateMemberMutation.mutateAsync,
		mergeMembersAsync: mergeMembersMutation.mutateAsync,
		reviewChangeRequestAsync: reviewChangeRequestMutation.mutateAsync,
		reviewCertificateRequestAsync: reviewCertificateRequestMutation.mutateAsync,
		reviewJobRequestAsync: reviewJobRequestMutation.mutateAsync,
		removeJobRequestAsync: removeJobRequestMutation.mutateAsync,
		isSavingMember:
			updateDepartmentMutation.isPending ||
			updateRoleMutation.isPending ||
			updateStatusMutation.isPending ||
			updateAccessRoleMutation.isPending ||
			updateMemberMutation.isPending,
		isMergingMembers: mergeMembersMutation.isPending,
		isReviewingChangeRequest: reviewChangeRequestMutation.isPending,
		isReviewingCertificateRequest: reviewCertificateRequestMutation.isPending,
		isReviewingJobRequest: reviewJobRequestMutation.isPending,
		isRemovingJobRequest: removeJobRequestMutation.isPending,
	};
}
