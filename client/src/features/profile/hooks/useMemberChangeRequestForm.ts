import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { normalizeTextValue } from "@/features/profile/profileUtils";
import {
	type MemberChangeRequest,
	useMemberChangeRequests,
} from "@/hooks/useMemberChangeRequests";

export interface UseMemberChangeRequestFormResult {
	requestedRole: string;
	setRequestedRole: (value: string) => void;
	requestedDepartment: string;
	setRequestedDepartment: (value: string) => void;
	isRequestingAlumniStatus: boolean;
	setIsRequestingAlumniStatus: (value: boolean) => void;
	changeRequestReason: string;
	setChangeRequestReason: (value: string) => void;
	latestMemberChangeRequest: MemberChangeRequest | undefined;
	isSubmittingChangeRequest: boolean;
	handleSubmitMemberChangeRequest: () => Promise<void>;
}

export function useMemberChangeRequestForm(
	userId: string,
): UseMemberChangeRequestFormResult {
	const { showToast } = useToast();
	const {
		requests: memberChangeRequests,
		submitChangeRequestAsync,
		isSubmitting: isSubmittingChangeRequest,
	} = useMemberChangeRequests(userId);

	const [requestedRole, setRequestedRole] = useState("");
	const [requestedDepartment, setRequestedDepartment] = useState("");
	const [isRequestingAlumniStatus, setIsRequestingAlumniStatus] =
		useState(false);
	const [changeRequestReason, setChangeRequestReason] = useState("");

	const latestMemberChangeRequest = memberChangeRequests[0];

	const handleSubmitMemberChangeRequest = async (): Promise<void> => {
		const memberRole = normalizeTextValue(requestedRole);
		const department = normalizeTextValue(requestedDepartment);
		const reason = changeRequestReason.trim();

		if (!memberRole && !department && !isRequestingAlumniStatus) {
			showToast(
				"Select a role, department, or alumni status change to request.",
				"warning",
			);
			return;
		}

		try {
			const changes: {
				member_role?: string;
				member_status?: string;
				department?: string;
			} = {};
			if (memberRole) changes.member_role = memberRole;
			if (department) changes.department = department;
			if (isRequestingAlumniStatus) changes.member_status = "alumni";

			await submitChangeRequestAsync({
				changes,
				reason: reason || undefined,
			});
			setRequestedRole("");
			setRequestedDepartment("");
			setIsRequestingAlumniStatus(false);
			setChangeRequestReason("");
			showToast("Change request sent to the admin and LnF team.", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to submit change request: ${errorMessage}`, "error");
		}
	};

	return {
		requestedRole,
		setRequestedRole,
		requestedDepartment,
		setRequestedDepartment,
		isRequestingAlumniStatus,
		setIsRequestingAlumniStatus,
		changeRequestReason,
		setChangeRequestReason,
		latestMemberChangeRequest,
		isSubmittingChangeRequest,
		handleSubmitMemberChangeRequest,
	};
}
