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
	// Whether the posting already carries stored allocations. The editor itself
	// starts from one fresh 100 % row either way, but a posting that has none has
	// nothing to "replace" — saying so would misstate what the save does.
	hasStoredAllocations: boolean;
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
// already-split posting and points here; with the Abgleich tab gone this is
// where "here" is — for the first split of a posting as much as for a later
// edit of one. Writing a split replaces every allocation of the posting, which
// is why it stays reviewer-only, exactly as the endpoint is.
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
						{preset?.label} ·{" "}
						{preset?.hasStoredAllocations === true
							? "ersetzt die bestehende Aufteilung der Buchung."
							: "diese Buchung hat noch keine gespeicherte Aufteilung — hier entsteht die erste."}
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
