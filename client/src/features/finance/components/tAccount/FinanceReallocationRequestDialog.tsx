import type {
	FinanceProject,
	FinanceReallocationRequestCreate,
} from "@member-manager/shared";
import type { ReactElement } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FinanceReallocationForm } from "@/features/finance/components/FinanceReallocationForm";

export interface FinanceReallocationDialogPreset {
	postingExternalId: string;
	label: string;
}

interface FinanceReallocationRequestDialogProps {
	preset: FinanceReallocationDialogPreset | null;
	projects: FinanceProject[];
	department: string | null;
	isPending: boolean;
	onClose: () => void;
	onSubmit: (input: FinanceReallocationRequestCreate) => Promise<void>;
}

// Asking another department to take a posting is the one allocation change a
// department member cannot simply make (the replace endpoint is reviewer-only),
// so it stays a request. It used to hang off the Abgleich tab's posting list;
// with that tab gone (FR-O) it belongs where the invoice is — its own row.
export function FinanceReallocationRequestDialog({
	preset,
	projects,
	department,
	isPending,
	onClose,
	onSubmit,
}: FinanceReallocationRequestDialogProps): ReactElement {
	return (
		<Dialog
			open={preset !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Umverteilung beantragen</DialogTitle>
					<DialogDescription>
						{preset?.label} · geht als Antrag an die LnF und erscheint dort
						unter „Anträge".
					</DialogDescription>
				</DialogHeader>
				{preset ? (
					<FinanceReallocationForm
						postingExternalId={preset.postingExternalId}
						projects={projects}
						department={department}
						isPending={isPending}
						onSubmit={async (input) => {
							await onSubmit(input);
							onClose();
						}}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
