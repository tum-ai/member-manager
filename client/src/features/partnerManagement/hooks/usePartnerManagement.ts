import { zodResolver } from "@hookform/resolvers/zod";
import {
	type CreatePartnerInput,
	createPartnerSchema,
	type ManagedPartner,
	type ManagedPartnerJob,
	type PartnerActivationResult,
	type PartnerCreationResult,
	type PartnerJobInput,
	type PartnerJobsData,
	type PartnerManagementData,
	type PartnerStatus,
	partnerJobInputSchema,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import {
	filterPartners,
	type PartnerStatusFilter,
} from "@/features/partnerManagement/partnerManagementUtils";
import { apiClient } from "@/lib/apiClient";

const EMPTY_FORM: CreatePartnerInput = {
	companyName: "",
	primaryEmail: "",
	tierId: "",
	contractStart: "",
	contractEnd: "",
	partnerKind: "tier_subscriber",
	websiteUrl: "",
	notes: "",
};

const EMPTY_JOB_FORM: PartnerJobInput = {
	title: "",
	jobType: "full_time",
	location: "",
	description: "",
	callToAction: "Apply now",
	contactName: "",
	contactEmail: "",
	contactRole: "",
	externalUrl: "",
	logoUrl: "",
};

export function usePartnerManagement() {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<PartnerStatusFilter>("all");
	const [formOpen, setFormOpen] = useState(false);
	const [selectedPartner, setSelectedPartner] = useState<ManagedPartner | null>(
		null,
	);
	const [archiveTarget, setArchiveTarget] = useState<ManagedPartner | null>(
		null,
	);
	const [unarchiveTarget, setUnarchiveTarget] = useState<ManagedPartner | null>(
		null,
	);
	const [activation, setActivation] = useState<{
		companyName: string;
		link: string;
		emailSent: boolean;
	} | null>(null);
	const [jobsPartner, setJobsPartner] = useState<ManagedPartner | null>(null);
	const [jobEditorMode, setJobEditorMode] = useState<"create" | "edit" | null>(
		null,
	);
	const [selectedJob, setSelectedJob] = useState<ManagedPartnerJob | null>(
		null,
	);
	const [jobDeleteTarget, setJobDeleteTarget] =
		useState<ManagedPartnerJob | null>(null);

	const form = useForm<CreatePartnerInput>({
		resolver: zodResolver(createPartnerSchema),
		defaultValues: EMPTY_FORM,
	});
	const jobForm = useForm<PartnerJobInput>({
		resolver: zodResolver(partnerJobInputSchema),
		defaultValues: EMPTY_JOB_FORM,
	});

	const query = useQuery<PartnerManagementData>({
		queryKey: ["partner-management"],
		queryFn: async () => await apiClient("/api/partners"),
	});
	const jobsQuery = useQuery<PartnerJobsData>({
		queryKey: ["partner-management", jobsPartner?.id, "jobs"],
		queryFn: async () =>
			await apiClient(`/api/partners/${jobsPartner?.id ?? ""}/jobs`),
		enabled: !!jobsPartner,
	});

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ["partner-management"] });
	};
	const refreshJobs = async () => {
		if (!jobsPartner) return;
		await queryClient.invalidateQueries({
			queryKey: ["partner-management", jobsPartner.id, "jobs"],
		});
	};

	const createMutation = useMutation<
		PartnerCreationResult,
		Error,
		CreatePartnerInput
	>({
		mutationFn: async (input) =>
			await apiClient("/api/partners", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: async (result, input) => {
			await refresh();
			setFormOpen(false);
			form.reset(EMPTY_FORM);
			showToast("Partner created.", "success");
			if (result.activationLink) {
				setActivation({
					companyName: input.companyName,
					link: result.activationLink,
					emailSent: result.activationEmailSent,
				});
			}
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const updateMutation = useMutation<
		{ ok: true },
		Error,
		{ id: string; input: CreatePartnerInput }
	>({
		mutationFn: async ({ id, input }) =>
			await apiClient(`/api/partners/${id}`, {
				method: "PATCH",
				body: JSON.stringify({
					companyName: input.companyName,
					tierId: input.tierId,
					contractStart: input.contractStart,
					contractEnd: input.contractEnd,
					partnerKind: input.partnerKind,
					websiteUrl: input.websiteUrl,
					notes: input.notes,
				}),
			}),
		onSuccess: async () => {
			await refresh();
			setFormOpen(false);
			setSelectedPartner(null);
			showToast("Partner updated.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const archiveMutation = useMutation<{ ok: true }, Error, ManagedPartner>({
		mutationFn: async (partner) =>
			await apiClient(`/api/partners/${partner.id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setArchiveTarget(null);
			showToast("Partner archived.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const unarchiveMutation = useMutation<{ ok: true }, Error, ManagedPartner>({
		mutationFn: async (partner) =>
			await apiClient(`/api/partners/${partner.id}/unarchive`, {
				method: "POST",
			}),
		onSuccess: async () => {
			await refresh();
			setUnarchiveTarget(null);
			showToast("Partner unarchived.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const activationMutation = useMutation<
		PartnerActivationResult,
		Error,
		ManagedPartner
	>({
		mutationFn: async (partner) =>
			await apiClient(`/api/partners/${partner.id}/activation-link`, {
				method: "POST",
			}),
		onSuccess: (result, partner) => {
			setActivation({
				companyName: partner.companyName,
				link: result.inviteLink,
				emailSent: result.activationEmailSent,
			});
			showToast("Activation link generated.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const createJobMutation = useMutation<
		{ job: ManagedPartnerJob },
		Error,
		{ partnerId: string; input: PartnerJobInput }
	>({
		mutationFn: async ({ partnerId, input }) =>
			await apiClient(`/api/partners/${partnerId}/jobs`, {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: async () => {
			await refreshJobs();
			setJobEditorMode(null);
			setSelectedJob(null);
			showToast("Job published.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const updateJobMutation = useMutation<
		{ job: ManagedPartnerJob },
		Error,
		{ partnerId: string; jobId: string; input: PartnerJobInput }
	>({
		mutationFn: async ({ partnerId, jobId, input }) =>
			await apiClient(`/api/partners/${partnerId}/jobs/${jobId}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: async () => {
			await refreshJobs();
			setJobEditorMode(null);
			setSelectedJob(null);
			showToast("Job updated.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const deleteJobMutation = useMutation<
		{ ok: true },
		Error,
		{ partnerId: string; jobId: string }
	>({
		mutationFn: async ({ partnerId, jobId }) =>
			await apiClient(`/api/partners/${partnerId}/jobs/${jobId}`, {
				method: "DELETE",
			}),
		onSuccess: async () => {
			await refreshJobs();
			setJobDeleteTarget(null);
			showToast("Job archived.", "success");
		},
		onError: (error) => showToast(error.message, "error"),
	});

	const compatibilityTierId =
		query.data?.tiers.find((tier) => tier.slug === "bronze")?.id ?? "";

	const normalizePartnerInput = (
		input: CreatePartnerInput,
	): CreatePartnerInput =>
		input.partnerKind === "single_job_buyer" && compatibilityTierId
			? { ...input, tierId: compatibilityTierId }
			: input;

	const openCreate = () => {
		setSelectedPartner(null);
		form.reset(EMPTY_FORM);
		setFormOpen(true);
	};

	const openEdit = (partner: ManagedPartner) => {
		setSelectedPartner(partner);
		form.reset({
			companyName: partner.companyName,
			primaryEmail: partner.primaryEmail,
			tierId: partner.tierId,
			contractStart: partner.contractStart,
			contractEnd: partner.contractEnd,
			partnerKind: partner.partnerKind,
			websiteUrl: partner.websiteUrl ?? "",
			notes: partner.notes ?? "",
		});
		setFormOpen(true);
	};

	const submitForm = form.handleSubmit(async (input) => {
		const normalized = normalizePartnerInput(input);
		if (selectedPartner) {
			await updateMutation.mutateAsync({
				id: selectedPartner.id,
				input: normalized,
			});
		} else {
			await createMutation.mutateAsync(normalized);
		}
	});

	const openJobs = (partner: ManagedPartner) => {
		setJobsPartner(partner);
		setJobEditorMode(null);
		setSelectedJob(null);
	};

	const closeJobs = () => {
		setJobsPartner(null);
		setJobEditorMode(null);
		setSelectedJob(null);
		setJobDeleteTarget(null);
	};

	const openCreateJob = () => {
		if (!jobsPartner) return;
		setSelectedJob(null);
		jobForm.reset({
			...EMPTY_JOB_FORM,
			contactEmail: jobsPartner.primaryEmail,
		});
		setJobEditorMode("create");
	};

	const openEditJob = (job: ManagedPartnerJob) => {
		setSelectedJob(job);
		jobForm.reset({
			title: job.title,
			jobType: job.jobType,
			location: job.location,
			description: job.description,
			callToAction: job.callToAction,
			contactName: job.contactName,
			contactEmail: job.contactEmail,
			contactRole: job.contactRole ?? "",
			externalUrl: job.externalUrl ?? "",
			logoUrl: job.logoUrl ?? "",
		});
		setJobEditorMode("edit");
	};

	const submitJobForm = jobForm.handleSubmit(async (input) => {
		if (!jobsPartner) return;
		if (selectedJob) {
			await updateJobMutation.mutateAsync({
				partnerId: jobsPartner.id,
				jobId: selectedJob.id,
				input,
			});
		} else {
			await createJobMutation.mutateAsync({
				partnerId: jobsPartner.id,
				input,
			});
		}
	});

	const copyActivationLink = async () => {
		if (!activation) return;
		try {
			await navigator.clipboard.writeText(activation.link);
			showToast("Activation link copied.", "success");
		} catch {
			showToast("Could not copy the activation link.", "error");
		}
	};

	const partners = query.data?.partners ?? [];
	const filteredPartners = filterPartners(partners, searchTerm, statusFilter);
	const currentPartners = filteredPartners.filter(
		(partner) => partner.status !== "archived",
	);
	const archivedPartners = filterPartners(
		partners.filter((partner) => partner.status === "archived"),
		searchTerm,
		"all",
	);
	const statusCounts = partners.reduce<Record<PartnerStatus, number>>(
		(counts, partner) => {
			counts[partner.status] += 1;
			return counts;
		},
		{ invited: 0, active: 0, expired: 0, archived: 0 },
	);

	return {
		partners: currentPartners,
		archivedPartners,
		currentPartnerCount: partners.filter(
			(partner) => partner.status !== "archived",
		).length,
		tiers: query.data?.tiers ?? [],
		statusCounts,
		isLoading: query.isLoading,
		error: query.error,
		searchTerm,
		setSearchTerm,
		statusFilter,
		setStatusFilter,
		form,
		formOpen,
		setFormOpen,
		selectedPartner,
		openCreate,
		openEdit,
		submitForm,
		isSaving: createMutation.isPending || updateMutation.isPending,
		archiveTarget,
		setArchiveTarget,
		confirmArchive: () => {
			if (archiveTarget) archiveMutation.mutate(archiveTarget);
		},
		isArchiving: archiveMutation.isPending,
		unarchiveTarget,
		setUnarchiveTarget,
		confirmUnarchive: () => {
			if (unarchiveTarget) unarchiveMutation.mutate(unarchiveTarget);
		},
		isUnarchiving: unarchiveMutation.isPending,
		generateActivationLink: (partner: ManagedPartner) =>
			activationMutation.mutate(partner),
		isGeneratingActivationLink: activationMutation.isPending,
		activation,
		setActivation,
		copyActivationLink,
		jobsPartner,
		openJobs,
		closeJobs,
		jobs: jobsQuery.data?.jobs ?? [],
		jobsLoading: jobsQuery.isLoading,
		jobsError: jobsQuery.error,
		jobEditorMode,
		jobForm,
		openCreateJob,
		openEditJob,
		cancelJobEdit: () => {
			setJobEditorMode(null);
			setSelectedJob(null);
		},
		submitJobForm,
		isSavingJob: createJobMutation.isPending || updateJobMutation.isPending,
		jobDeleteTarget,
		setJobDeleteTarget,
		confirmDeleteJob: () => {
			if (jobsPartner && jobDeleteTarget) {
				deleteJobMutation.mutate({
					partnerId: jobsPartner.id,
					jobId: jobDeleteTarget.id,
				});
			}
		},
		isDeletingJob: deleteJobMutation.isPending,
	};
}
