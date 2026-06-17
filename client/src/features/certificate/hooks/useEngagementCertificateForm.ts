import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { useToast } from "@/contexts/ToastContext";
import { generateEngagementCertificatePdf } from "@/features/certificate/generators/engagementCertificatePdf";
import { useEngagementCertificateRequests } from "@/hooks/useEngagementCertificateRequests";
import { useMemberData } from "@/hooks/useMemberData";
import { downloadPdfBlob, formatGermanDate } from "@/lib/pdfUtils";
import {
	type EngagementFormSchema,
	type EngagementSchema,
	engagementFormSchema,
} from "@/lib/schemas";

function createDefaultEngagement(): EngagementSchema {
	return {
		id: crypto.randomUUID(),
		startDate: "",
		endDate: "",
		isStillActive: false,
		weeklyHours: "",
		department: "",
		isTeamLead: false,
		specialRole: "",
		tasksDescription: "",
	};
}

export function useEngagementCertificateForm(userId: string) {
	const { member, isLoading, error: fetchError } = useMemberData(userId);
	const { requests, submitRequestAsync, isSubmitting } =
		useEngagementCertificateRequests(userId);
	const { showToast } = useToast();
	const [isGenerating, setIsGenerating] = useState(false);

	const form = useForm<EngagementFormSchema>({
		resolver: zodResolver(engagementFormSchema),
		defaultValues: {
			engagements: [createDefaultEngagement()],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "engagements",
	});

	const latestRequest = requests[0];
	const approvedRequest = requests.find(
		(request) => request.status === "approved",
	);
	const isRequestPending = latestRequest?.status === "pending";

	const handleSubmitForApproval = async (
		data: EngagementFormSchema,
	): Promise<void> => {
		if (!member) {
			showToast("Member data not available", "error");
			return;
		}

		try {
			await submitRequestAsync(data);
			showToast("Certificate request submitted for admin approval.", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(
				`Error submitting certificate request: ${errorMessage}`,
				"error",
			);
		} finally {
			form.reset({
				engagements: data.engagements,
			});
		}
	};

	const handleDownloadApproved = async (): Promise<void> => {
		if (!member || !approvedRequest || isGenerating) {
			return;
		}

		setIsGenerating(true);
		try {
			const pdfBlob = await generateEngagementCertificatePdf(
				member,
				approvedRequest.engagements,
			);
			const safeGivenName = member.given_name.replace(/[^a-zA-Z0-9-_]/g, "-");
			const safeSurname = member.surname.replace(/[^a-zA-Z0-9-_]/g, "-");
			const fullName = `${safeGivenName}-${safeSurname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Engagement_Certificate_${fullName}.pdf`);
			showToast("Approved certificate downloaded successfully!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error generating certificate: ${errorMessage}`, "error");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleAddEngagement = (): void => {
		if (fields.length >= 5) {
			showToast("Maximum 5 engagements allowed", "warning");
			return;
		}
		append(createDefaultEngagement());
	};

	const handleRemoveEngagement = (index: number): void => {
		if (fields.length <= 1) {
			showToast("At least one engagement is required", "warning");
			return;
		}
		remove(index);
	};

	const birthDate = member ? formatGermanDate(member.date_of_birth) : "";

	return {
		member,
		isLoading,
		fetchError,
		form,
		fields,
		isSubmitting,
		isGenerating,
		latestRequest,
		approvedRequest,
		isRequestPending,
		birthDate,
		handleSubmitForApproval,
		handleDownloadApproved,
		handleAddEngagement,
		handleRemoveEngagement,
	};
}
