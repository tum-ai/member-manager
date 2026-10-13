import { doorPinSchema, type MemberDoorPin } from "@member-manager/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	memberDoorPinQueryKey,
	useMemberDoorPin,
} from "@/hooks/useMemberDoorPin";
import { apiClient } from "@/lib/apiClient";

/**
 * State for the door PIN field in the admin member editor. The current PIN is
 * only fetched when the admin asks to see it, so opening the editor doesn't
 * pull every member's PIN into the browser.
 */
export function useAdminMemberDoorPin(userId: string | null) {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const [isRevealed, setIsRevealed] = useState(false);
	const [draftPin, setDraftPin] = useState("");
	const [isConfirmingClear, setIsConfirmingClear] = useState(false);

	// A different member (or a closed editor) starts from scratch, hidden.
	// Resetting during render avoids one frame showing the previous state.
	const [trackedUserId, setTrackedUserId] = useState(userId);
	if (trackedUserId !== userId) {
		setTrackedUserId(userId);
		setIsRevealed(false);
		setDraftPin("");
		setIsConfirmingClear(false);
	}

	const { doorPin, isFetching, error } = useMemberDoorPin(userId ?? "", {
		enabled: Boolean(userId) && isRevealed,
	});

	const setMutation = useMutation({
		mutationFn: async (pin: string) =>
			(await apiClient(`/api/admin/members/${userId}/door-pin`, {
				method: "PUT",
				body: JSON.stringify({ pin }),
			})) as MemberDoorPin,
		onSuccess: (saved) => {
			if (!userId) return;
			queryClient.setQueryData(memberDoorPinQueryKey(userId), saved);
		},
	});

	const clearMutation = useMutation({
		mutationFn: async () => {
			await apiClient(`/api/admin/members/${userId}/door-pin`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			if (!userId) return;
			const cleared: MemberDoorPin = { status: "not_assigned" };
			queryClient.setQueryData(memberDoorPinQueryKey(userId), cleared);
		},
	});

	const draftValidation = doorPinSchema.safeParse(draftPin);
	const draftError =
		draftPin.trim() !== "" && !draftValidation.success
			? (draftValidation.error.issues[0]?.message ?? "Invalid door PIN")
			: null;

	const savePin = async (): Promise<void> => {
		if (!userId || !draftValidation.success) return;
		try {
			await setMutation.mutateAsync(draftValidation.data);
			setDraftPin("");
			setIsRevealed(true);
			showToast("Door PIN saved.", "success");
		} catch (saveError) {
			showToast(
				saveError instanceof Error
					? saveError.message
					: "Could not save the door PIN.",
				"error",
			);
		}
	};

	const clearPin = async (): Promise<void> => {
		if (!userId) return;
		try {
			await clearMutation.mutateAsync();
			setIsConfirmingClear(false);
			showToast("Door PIN cleared.", "success");
		} catch (clearError) {
			showToast(
				clearError instanceof Error
					? clearError.message
					: "Could not clear the door PIN.",
				"error",
			);
		}
	};

	return {
		doorPin: isRevealed ? doorPin : undefined,
		isRevealed,
		isLoadingPin: isRevealed && isFetching && !doorPin,
		hasLoadError: isRevealed && Boolean(error),
		toggleRevealed: () => setIsRevealed((current) => !current),
		draftPin,
		setDraftPin,
		draftError,
		canSavePin: draftValidation.success && !setMutation.isPending,
		isSavingPin: setMutation.isPending,
		savePin,
		isConfirmingClear,
		requestClear: () => setIsConfirmingClear(true),
		cancelClear: () => setIsConfirmingClear(false),
		clearPin,
		isClearingPin: clearMutation.isPending,
	};
}

export type AdminMemberDoorPinState = ReturnType<typeof useAdminMemberDoorPin>;
