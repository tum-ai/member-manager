import type { User } from "@supabase/supabase-js";
import type React from "react";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { ReimbursementFormSection } from "./components/ReimbursementFormSection";
import { ReimbursementRequestsSection } from "./components/ReimbursementRequestsSection";
import { useReimbursementForm } from "./hooks/useReimbursementForm";

interface ReimbursementPageProps {
	user: User;
}

export default function ReimbursementPage({
	user,
}: ReimbursementPageProps): React.ReactElement {
	const {
		values,
		errors,
		isLoading,
		error,
		isCreating,
		isReceiptBusy,
		isDraggingReceipt,
		setIsDraggingReceipt,
		isSubmitDisabled,
		showDepartmentWarning,
		sortedRequests,
		setField,
		handleSubmissionTypeChange,
		handleReceiptChange,
		handleReceiptDrop,
		handleSubmit,
	} = useReimbursementForm(user.id);

	return (
		<ToolPageShell
			title="Reimbursements"
			description="Submit reimbursements or vendor invoices to the Legal and Finance department."
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.35fr)]">
				<ReimbursementRequestsSection
					isLoading={isLoading}
					error={error}
					requests={sortedRequests}
				/>

				<ReimbursementFormSection
					values={values}
					errors={errors}
					isCreating={isCreating}
					isReceiptBusy={isReceiptBusy}
					isDraggingReceipt={isDraggingReceipt}
					isSubmitDisabled={isSubmitDisabled}
					showDepartmentWarning={showDepartmentWarning}
					onDraggingChange={setIsDraggingReceipt}
					onReceiptDrop={handleReceiptDrop}
					onReceiptChange={handleReceiptChange}
					onSubmissionTypeChange={handleSubmissionTypeChange}
					onFieldChange={setField}
					onSubmit={handleSubmit}
				/>
			</div>
		</ToolPageShell>
	);
}
