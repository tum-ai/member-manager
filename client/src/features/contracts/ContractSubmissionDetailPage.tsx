import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { ContractSubmissionActionsSection } from "./components/ContractSubmissionActionsSection";
import { ContractSubmissionCommentsSection } from "./components/ContractSubmissionCommentsSection";
import { ContractSubmissionDetailSkeleton } from "./components/ContractSubmissionDetailSkeleton";
import { ContractSubmissionDocxSection } from "./components/ContractSubmissionDocxSection";
import { ContractSubmissionSignatureSections } from "./components/ContractSubmissionSignatureSections";
import {
	ContractSubmissionFormDataSection,
	ContractSubmissionStatusSection,
} from "./components/ContractSubmissionSummarySections";
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
			description="Review the stored PDF and progress this contract through the workflow."
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
				{detail.isDocxDocument ? (
					<ContractSubmissionDocxSection detail={detail} />
				) : (
					<Alert>
						<AlertDescription>
							This historical contract uses a retired document engine and is
							read only. New contracts use DOCX files and stored PDFs.
						</AlertDescription>
					</Alert>
				)}
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
