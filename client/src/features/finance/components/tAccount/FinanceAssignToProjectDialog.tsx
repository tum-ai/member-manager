import { Loader2 } from "lucide-react";
import { type ReactElement, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { FinanceProject } from "@/features/finance/financeTypes";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

export interface FinanceAssignDialogPreset {
	postingExternalIds: string[];
	selectionSum: number;
}

interface FinanceAssignToProjectDialogProps {
	preset: FinanceAssignDialogPreset | null;
	projects: FinanceProject[];
	isPending: boolean;
	onClose: () => void;
	onSubmit: (projectId: string, postingExternalIds: string[]) => Promise<void>;
}

// FR-L2: file invoices into a project that already exists — from the selection
// bar for many, or from one expanded row for a single invoice. Both go through
// the same endpoint, so both refuse the same things.
export function FinanceAssignToProjectDialog({
	preset,
	projects,
	isPending,
	onClose,
	onSubmit,
}: FinanceAssignToProjectDialogProps): ReactElement {
	const fieldId = useId();
	const [projectId, setProjectId] = useState("");
	const [error, setError] = useState<string | null>(null);

	const count = preset?.postingExternalIds.length ?? 0;

	function handleOpenChange(open: boolean): void {
		if (!open) {
			setProjectId("");
			setError(null);
			onClose();
		}
	}

	async function handleSubmit(): Promise<void> {
		if (projectId === "") {
			setError("Bitte ein Projekt wählen.");
			return;
		}
		setError(null);
		await onSubmit(projectId, preset?.postingExternalIds ?? []);
		setProjectId("");
	}

	return (
		<Dialog open={preset !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Zu Projekt hinzufügen</DialogTitle>
					<DialogDescription>
						{count} {count === 1 ? "Buchung" : "Buchungen"} über{" "}
						{formatFinanceAmount(preset?.selectionSum ?? 0)} zuordnen.
					</DialogDescription>
				</DialogHeader>

				<Field label="Projekt" htmlFor={`${fieldId}-project`} required>
					{projects.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Für dieses Department und diesen Zeitraum gibt es noch kein
							Projekt. Lege zuerst eines an.
						</p>
					) : (
						<Select value={projectId} onValueChange={setProjectId}>
							<SelectTrigger id={`${fieldId}-project`} aria-label="Projekt">
								<SelectValue placeholder="Projekt wählen" />
							</SelectTrigger>
							<SelectContent>
								{projects.map((project) => (
									<SelectItem key={project.id} value={project.id}>
										{project.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>

				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
					>
						Abbrechen
					</Button>
					<Button
						type="button"
						disabled={isPending || projects.length === 0}
						onClick={() => {
							void handleSubmit();
						}}
					>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						Zuordnen
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
