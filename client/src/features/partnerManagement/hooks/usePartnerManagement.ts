import { zodResolver } from "@hookform/resolvers/zod";
import {
	type CreatePartnerInput,
	createPartnerSchema,
	type ManagedPartner,
	type PartnerActivationResult,
	type PartnerCreationResult,
	type PartnerManagementData,
	type PartnerStatus,
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
	const [activation, setActivation] = useState<{
		companyName: string;
		link: string;
		emailSent: boolean;
	} | null>(null);

	const form = useForm<CreatePartnerInput>({
		resolver: zodResolver(createPartnerSchema),
		defaultValues: EMPTY_FORM,
	});

	const query = useQuery<PartnerManagementData>({
		queryKey: ["partner-management"],
		queryFn: async () => await apiClient("/api/partners"),
	});

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ["partner-management"] });
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
		if (selectedPartner) {
			await updateMutation.mutateAsync({ id: selectedPartner.id, input });
		} else {
			await createMutation.mutateAsync(input);
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
	const statusCounts = partners.reduce<Record<PartnerStatus, number>>(
		(counts, partner) => {
			counts[partner.status] += 1;
			return counts;
		},
		{ invited: 0, active: 0, expired: 0, archived: 0 },
	);

	return {
		partners: filterPartners(partners, searchTerm, statusFilter),
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
		generateActivationLink: (partner: ManagedPartner) =>
			activationMutation.mutate(partner),
		isGeneratingActivationLink: activationMutation.isPending,
		activation,
		setActivation,
		copyActivationLink,
	};
}
