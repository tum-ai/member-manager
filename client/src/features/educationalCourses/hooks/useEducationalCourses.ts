import {
	type CreateEducationalCoursePeriodInput,
	type EducationalCourseApplication,
	type EducationalCourseParticipant,
	type EducationalCourseParticipantCandidate,
	type EducationalCourseParticipantCandidateList,
	type EducationalCourseParticipantList,
	type EducationalCoursePeriod,
	type EducationalCoursePeriodDetail,
	type EducationalCoursePeriodList,
	reviewEducationalCourseApplicationSchema,
	updateEducationalCoursePeriodSchema,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToolAccess } from "@/hooks/useToolAccess";
import { apiClient } from "@/lib/apiClient";

const PERIODS_QUERY_KEY = ["educational-course-periods"] as const;
const PARTICIPANTS_QUERY_KEY = ["educational-course-participants"] as const;
const PARTICIPANT_SEARCH_DELAY_MS = 250;

export function useEducationalCourses() {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const isMobile = useIsMobile();
	const { educationalCourseRole } = useToolAccess();
	const isAdministrator = educationalCourseRole === "administrator";
	const isParticipant = educationalCourseRole === "participant";
	const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
	const [participantSearch, setParticipantSearch] = useState("");
	const [debouncedParticipantSearch, setDebouncedParticipantSearch] =
		useState("");

	useEffect(() => {
		const normalized = participantSearch.trim();
		if (normalized.length < 2) {
			setDebouncedParticipantSearch("");
			return;
		}

		const timeoutId = window.setTimeout(
			() => setDebouncedParticipantSearch(normalized),
			PARTICIPANT_SEARCH_DELAY_MS,
		);
		return () => window.clearTimeout(timeoutId);
	}, [participantSearch]);

	const periodsQuery = useQuery<EducationalCoursePeriodList>({
		queryKey: PERIODS_QUERY_KEY,
		queryFn: async () => await apiClient("/api/education/periods"),
		enabled: Boolean(educationalCourseRole),
	});
	const periods = periodsQuery.data?.periods ?? [];

	useEffect(() => {
		if (periods.length === 0) {
			setSelectedPeriodId(null);
			return;
		}
		if (
			!selectedPeriodId ||
			!periods.some((period) => period.id === selectedPeriodId)
		) {
			// Select the chronologically first period so the review panel always
			// matches the first card the periods section renders, whatever order
			// the API happens to return.
			const [firstPeriod] = [...periods].sort((left, right) =>
				left.startsOn.localeCompare(right.startsOn),
			);
			setSelectedPeriodId(firstPeriod.id);
		}
	}, [periods, selectedPeriodId]);

	const detailQuery = useQuery<EducationalCoursePeriodDetail>({
		queryKey: ["educational-course-period", selectedPeriodId],
		queryFn: async () =>
			await apiClient(`/api/education/periods/${selectedPeriodId}`),
		enabled: isAdministrator && Boolean(selectedPeriodId),
	});

	const participantsQuery = useQuery<EducationalCourseParticipantList>({
		queryKey: PARTICIPANTS_QUERY_KEY,
		queryFn: async () => await apiClient("/api/education/participants"),
		enabled: isAdministrator,
	});
	const participantCandidatesQuery =
		useQuery<EducationalCourseParticipantCandidateList>({
			queryKey: [
				"educational-course-participant-candidates",
				debouncedParticipantSearch,
			],
			queryFn: async () =>
				await apiClient(
					`/api/education/participant-candidates?search=${encodeURIComponent(debouncedParticipantSearch)}`,
				),
			enabled: isAdministrator && debouncedParticipantSearch.length >= 2,
		});

	function invalidatePeriods(periodId?: string) {
		queryClient.invalidateQueries({ queryKey: PERIODS_QUERY_KEY });
		if (periodId) {
			queryClient.invalidateQueries({
				queryKey: ["educational-course-period", periodId],
			});
		}
	}

	const createPeriodMutation = useMutation<
		EducationalCoursePeriod,
		Error,
		CreateEducationalCoursePeriodInput
	>({
		mutationFn: async (input) =>
			await apiClient("/api/education/periods", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: (period) => {
			showToast("Course period created.", "success");
			setSelectedPeriodId(period.id);
			invalidatePeriods(period.id);
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const updatePeriodMutation = useMutation<
		EducationalCoursePeriod,
		Error,
		{ periodId: string; applicationsOpen: boolean }
	>({
		mutationFn: async ({ periodId, applicationsOpen }) =>
			await apiClient(`/api/education/periods/${periodId}`, {
				method: "PATCH",
				body: JSON.stringify({ applicationsOpen }),
			}),
		onSuccess: (period) => {
			showToast(
				period.applicationsOpen
					? "Applications opened."
					: "Applications closed.",
				"success",
			);
			invalidatePeriods(period.id);
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const deletePeriodMutation = useMutation<void, Error, string>({
		mutationFn: async (periodId) =>
			await apiClient(`/api/education/periods/${periodId}`, {
				method: "DELETE",
			}),
		onSuccess: (_, periodId) => {
			showToast("Course period deleted.", "success");
			if (selectedPeriodId === periodId) setSelectedPeriodId(null);
			invalidatePeriods(periodId);
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const applyMutation = useMutation<
		EducationalCourseApplication,
		Error,
		string
	>({
		mutationFn: async (periodId) =>
			await apiClient(`/api/education/periods/${periodId}/applications`, {
				method: "POST",
			}),
		onSuccess: (_, periodId) => {
			showToast("Application submitted.", "success");
			invalidatePeriods(periodId);
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const withdrawMutation = useMutation<void, Error, string>({
		mutationFn: async (periodId) =>
			await apiClient(`/api/education/periods/${periodId}/applications/me`, {
				method: "DELETE",
			}),
		onSuccess: (_, periodId) => {
			showToast("Application withdrawn.", "success");
			invalidatePeriods(periodId);
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const reviewMutation = useMutation<
		EducationalCourseApplication,
		Error,
		{
			applicationId: string;
			periodId: string;
			decision: "approved" | "rejected";
		}
	>({
		mutationFn: async ({ applicationId, decision }) =>
			await apiClient(`/api/education/applications/${applicationId}`, {
				method: "PATCH",
				body: JSON.stringify({ decision }),
			}),
		onSuccess: (_, { periodId, decision }) => {
			showToast(
				decision === "approved"
					? "Application approved."
					: "Application rejected.",
				"success",
			);
			invalidatePeriods(periodId);
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const participantMutation = useMutation<
		EducationalCourseParticipant | undefined,
		Error,
		{ userId: string; enabled: boolean }
	>({
		mutationFn: async ({ userId, enabled }) =>
			await apiClient(`/api/education/participants/${userId}`, {
				method: enabled ? "PUT" : "DELETE",
			}),
		onSuccess: (_, { enabled }) => {
			showToast(
				enabled ? "Participant added." : "Participant removed.",
				"success",
			);
			setParticipantSearch("");
			queryClient.invalidateQueries({ queryKey: PARTICIPANTS_QUERY_KEY });
		},
		onError: (error) => showToast(error.message, "error"),
	});

	function setApplicationsOpen(periodId: string, applicationsOpen: boolean) {
		const parsed = updateEducationalCoursePeriodSchema.safeParse({
			applicationsOpen,
		});
		if (!parsed.success) return;
		updatePeriodMutation.mutate({ periodId, ...parsed.data });
	}

	function deletePeriod(periodId: string) {
		if (
			window.confirm(
				"Delete this course period? This is only possible before anyone applies.",
			)
		) {
			deletePeriodMutation.mutate(periodId);
		}
	}

	function reviewApplication(
		applicationId: string,
		periodId: string,
		decision: "approved" | "rejected",
	) {
		const parsed = reviewEducationalCourseApplicationSchema.safeParse({
			decision,
		});
		if (!parsed.success) return;
		reviewMutation.mutate({ applicationId, periodId, ...parsed.data });
	}

	const participants = participantsQuery.data?.participants ?? [];
	const candidates = participantCandidatesQuery.data?.candidates ?? [];
	const participantIds = useMemo(
		() => new Set(participants.map((participant) => participant.userId)),
		[participants],
	);
	const eligibleMembers = useMemo<
		EducationalCourseParticipantCandidate[]
	>(() => {
		return candidates
			.filter((member) => !participantIds.has(member.userId))
			.slice(0, 12);
	}, [candidates, participantIds]);

	return {
		role: educationalCourseRole,
		isAdministrator,
		isParticipant,
		isMobile,
		periods,
		isLoadingPeriods: periodsQuery.isLoading,
		periodsError: periodsQuery.error,
		selectedPeriodId,
		setSelectedPeriodId,
		selectedPeriodDetail: detailQuery.data ?? null,
		isLoadingPeriodDetail: detailQuery.isLoading,
		createPeriod: async (input: CreateEducationalCoursePeriodInput) => {
			await createPeriodMutation.mutateAsync(input);
		},
		isCreatingPeriod: createPeriodMutation.isPending,
		setApplicationsOpen,
		isUpdatingPeriod: updatePeriodMutation.isPending,
		deletePeriod,
		isDeletingPeriod: deletePeriodMutation.isPending,
		apply: (periodId: string) => applyMutation.mutate(periodId),
		withdraw: (periodId: string) => withdrawMutation.mutate(periodId),
		isUpdatingApplication:
			applyMutation.isPending || withdrawMutation.isPending,
		reviewApplication,
		isReviewingApplication: reviewMutation.isPending,
		participants,
		isLoadingParticipants: participantsQuery.isLoading,
		isSearchingParticipants:
			participantSearch.trim().length >= 2 &&
			(debouncedParticipantSearch !== participantSearch.trim() ||
				participantCandidatesQuery.isFetching),
		participantSearch,
		setParticipantSearch,
		eligibleMembers,
		setParticipant: (userId: string, enabled: boolean) =>
			participantMutation.mutate({ userId, enabled }),
		isUpdatingParticipant: participantMutation.isPending,
	};
}
