import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "@/features/reimbursements/reimbursementSubmitUtils";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { useReimbursementRequests } from "@/hooks/useReimbursementRequests";

/**
 * State and receipt actions for the member's own request detail dialog.
 *
 * The selected request is resolved by id from the live requests query, so the
 * dialog reflects refetched status changes. The id survives closing so the
 * content stays rendered while the dialog animates out.
 */
export function useReimbursementRequestDetail(userId: string) {
	const { showToast } = useToast();
	const {
		requests,
		openReceiptAsync,
		isOpeningReceipt,
		downloadReceiptAsync,
		isDownloadingReceipt,
	} = useReimbursementRequests(userId);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [isOpen, setIsOpen] = useState(false);

	const selectedRequest =
		requests.find((request) => request.id === selectedRequestId) ?? null;

	const openDetail = (request: ReimbursementRequest): void => {
		setSelectedRequestId(request.id);
		setIsOpen(true);
	};

	const handleReceipt = async (mode: "view" | "download"): Promise<void> => {
		if (!selectedRequest) return;
		try {
			if (mode === "view") {
				await openReceiptAsync(selectedRequest);
			} else {
				await downloadReceiptAsync(selectedRequest);
			}
		} catch (receiptError) {
			showToast(
				`Could not open receipt: ${getErrorMessage(receiptError)}`,
				"error",
			);
		}
	};

	return {
		selectedRequest,
		isDetailOpen: isOpen && selectedRequest !== null,
		openDetail,
		setDetailOpen: setIsOpen,
		handleViewReceipt: () => handleReceipt("view"),
		handleDownloadReceipt: () => handleReceipt("download"),
		isOpeningReceipt,
		isDownloadingReceipt,
	};
}
