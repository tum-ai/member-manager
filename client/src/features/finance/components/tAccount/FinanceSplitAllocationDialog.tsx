import type { FinanceProject } from "@member-manager/shared";
import type { ReactElement } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FinanceAllocationEditor } from "@/features/finance/components/FinanceAllocationEditor";
import type {
	PostingAllocationInput,
	ProjectAllocationInput,
} from "@/features/finance/hooks/useFinanceManagement";

export interface FinanceSplitDialogPreset {
	postingExternalId: string;
	label: string;
}

interface FinanceSplitAllocationDialogProps {
	preset: FinanceSplitDialogPreset | null;
	projects: FinanceProject[];
	department: string | null;
	isPending: boolean;
	onClose: () => void;
	onAllocateToProject: (input: ProjectAllocationInput) => Promise<void>;
	onSplitAllocation: (input: PostingAllocationInput) => Promise<void>;
}

// The split editor, moved into the invoice it edits. The bulk assign refuses an
// already-split posting and points here (FR-L5); with the Abgleich tab gone
// (FR-O) this is where "here" is. Writing a split replaces every allocation of
// the posting, which is why it stays reviewer-only, exactly as the endpoint is.
export function FinanceSplitAllocationDialog({
	preset,
	projects,
	department,
	isPending,
	onClose,
	onAllocateToProject,
	onSplitAllocation,
}: FinanceSplitAllocationDialogProps): ReactElement {
	return (
		<Dialog
			open={preset !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Aufteilung bearbeiten</DialogTitle>
					<DialogDescription>
						{preset?.label} · ersetzt die bestehende Aufteilung der Buchung.
					</DialogDescription>
				</DialogHeader>
				{preset ? (
					<FinanceAllocationEditor
						postingExternalId={preset.postingExternalId}
						projects={projects}
						department={department}
						isPending={isPending}
						onAllocateToProject={async (input) => {
							await onAllocateToProject(input);
							onClose();
						}}
						onSplitAllocation={async (input) => {
							await onSplitAllocation(input);
							onClose();
						}}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
