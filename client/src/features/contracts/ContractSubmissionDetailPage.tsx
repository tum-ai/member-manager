import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { ContractSubmissionActionsSection } from "./components/ContractSubmissionActionsSection";
import { ContractSubmissionCommentsSection } from "./components/ContractSubmissionCommentsSection";
import { ContractSubmissionDetailSkeleton } from "./components/ContractSubmissionDetailSkeleton";
import { ContractSubmissionSignatureSections } from "./components/ContractSubmissionSignatureSections";
import {
	ContractSubmissionFormDataSection,
	ContractSubmissionStatusSection,
} from "./components/ContractSubmissionSummarySections";
import { ContractSubmissionTextSection } from "./components/ContractSubmissionTextSection";
import { useContractSubmissionDetail } from "./hooks/useContractSubmissionDetail";

export default function ContractSubmissionDetailPage(): JSX.Element {
	const detail = useContractSubmissionDetail();

	if (detail.submissionLoading) return <ContractSubmissionDetailSkeleton />;
	if (detail.submissionError) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{detail.submissionError.message}</AlertDescription>
			</Alert>
		);
	}

	const { submission } = detail;
	if (!submission) {
		return (
			<Alert>
				<AlertDescription>Not found</AlertDescription>
			</Alert>
		);
	}

	return (
		<ToolPageShell
			title={detail.title}
			description="Review, edit and progress this contract through the workflow."
		>
			<ContractSubmissionStatusSection
					submission={submission}
					statusEvents={detail.statusEvents}
					statusEventsLoading={detail.statusEventsLoading}
					isContractsAdmin={detail.isContractsAdmin}
					busy={detail.busy}
					onManualStatusChange={detail.setManualStatus}
				/>

			<div className="flex flex-col gap-6">
				<ContractSubmissionFormDataSection
					submission={submission}
					formEntries={detail.formEntries}
				/>
				<ContractSubmissionTextSection
					submission={submission}
					isContractsAdmin={detail.isContractsAdmin}
					editedText={detail.editedText}
					notes={detail.notes}
					previewPages={detail.previewPages}
					previewLoading={detail.previewLoading}
					onEditedTextChange={detail.setEditedText}
					onNotesChange={detail.setNotes}
				/>
				<ContractSubmissionActionsSection
					submission={submission}
					detail={detail}
				/>
				<ContractSubmissionCommentsSection
					submission={submission}
					comments={detail.comments}
					commentsLoading={detail.commentsLoading}
					commentsError={detail.commentsError}
					hasLegacyComment={detail.hasLegacyComment}
					isContractsAdmin={detail.isContractsAdmin}
					internalComment={detail.internalComment}
					busy={detail.busy}
					onInternalCommentChange={detail.setInternalComment}
					onAddInternalReply={detail.addInternalReply}
				/>
				<ContractSubmissionSignatureSections
					submission={submission}
					detail={detail}
				/>
			</div>
		</ToolPageShell>
	);
}
