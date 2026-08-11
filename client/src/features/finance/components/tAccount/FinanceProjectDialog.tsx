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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	FinanceBereich,
	FinanceProjectStatus,
} from "@/features/finance/financeTypes";
import {
	FINANCE_BEREICH_OPTIONS,
	formatFinanceAmount,
} from "@/features/finance/financeUtils";
import type { TAccountProjectInput } from "@/features/finance/hooks/useFinanceTAccountActions";

const NO_VALUE = "none";

const STATUS_OPTIONS: ReadonlyArray<{
	value: FinanceProjectStatus;
	label: string;
}> = [
	{ value: "draft", label: "Entwurf" },
	{ value: "active", label: "Aktiv" },
	{ value: "completed", label: "Abgeschlossen" },
	{ value: "cancelled", label: "Storniert" },
];

// What the node the action was triggered on already decides: a sub-team folder
// presets its sub-team, a project presets itself as the parent (FR-L3).
export interface FinanceProjectDialogPreset {
	parentProjectId: string | null;
	parentProjectName: string | null;
	subTeam: string | null;
	// Invoices to file into the new project (FR-L1); empty = create an empty
	// folder.
	postingExternalIds: string[];
	selectionSum: number;
}

interface FinanceProjectDialogProps {
	preset: FinanceProjectDialogPreset | null;
	isPending: boolean;
	onClose: () => void;
	onSubmit: (input: TAccountProjectInput) => Promise<void>;
}

export function FinanceProjectDialog({
	preset,
	isPending,
	onClose,
	onSubmit,
}: FinanceProjectDialogProps): ReactElement {
	const fieldId = useId();
	const [name, setName] = useState("");
	const [targetAmount, setTargetAmount] = useState("");
	const [status, setStatus] = useState<FinanceProjectStatus>("active");
	const [taxArea, setTaxArea] = useState<string>(NO_VALUE);
	const [error, setError] = useState<string | null>(null);

	const isSubProject = preset?.parentProjectId != null;
	const selectionCount = preset?.postingExternalIds.length ?? 0;

	function reset(): void {
		setName("");
		setTargetAmount("");
		setStatus("active");
		setTaxArea(NO_VALUE);
		setError(null);
	}

	function handleOpenChange(open: boolean): void {
		if (!open) {
			reset();
			onClose();
		}
	}

	async function handleSubmit(): Promise<void> {
		const trimmed = name.trim();
		if (trimmed === "") {
			setError("Bitte einen Namen angeben.");
			return;
		}
		const parsedTarget = targetAmount.trim() === "" ? 0 : Number(targetAmount);
		if (Number.isNaN(parsedTarget)) {
			setError("Zielsaldo muss eine Zahl sein.");
			return;
		}
		setError(null);
		await onSubmit({
			name: trimmed,
			parentProjectId: preset?.parentProjectId ?? null,
			subTeam: preset?.subTeam ?? null,
			taxArea: taxArea === NO_VALUE ? null : (taxArea as FinanceBereich),
			targetAmount: parsedTarget,
			status,
			postingExternalIds: preset?.postingExternalIds ?? [],
		});
		reset();
	}

	return (
		<Dialog open={preset !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isSubProject ? "Neues Teilprojekt" : "Neues Projekt"}
					</DialogTitle>
					<DialogDescription>
						{selectionCount > 0
							? `${selectionCount} ${selectionCount === 1 ? "Buchung" : "Buchungen"} über ${formatFinanceAmount(preset?.selectionSum ?? 0)} werden dem neuen Projekt zugeordnet.`
							: "Das Projekt wird als leerer Ordner angelegt."}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					<Field label="Name" htmlFor={`${fieldId}-name`} required>
						<Input
							id={`${fieldId}-name`}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="z. B. Sponsoring-Kampagne"
						/>
					</Field>

					{/* Parent and sub-team come from the folder the action was started
					    in and are shown as facts, not as editable fields — moving a
					    project is a different operation. */}
					{isSubProject ? (
						<Field label="Übergeordnetes Projekt">
							<p className="text-sm text-foreground">
								{preset?.parentProjectName ?? "Projekt"}
							</p>
						</Field>
					) : null}
					{preset?.subTeam ? (
						<Field
							label="Sub-Team"
							description="Aus dem Ordner übernommen, in dem das Projekt angelegt wird."
						>
							<p className="text-sm text-foreground">{preset.subTeam}</p>
						</Field>
					) : null}

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Zielsaldo (€)" htmlFor={`${fieldId}-target`}>
							<Input
								id={`${fieldId}-target`}
								type="number"
								inputMode="decimal"
								value={targetAmount}
								onChange={(event) => setTargetAmount(event.target.value)}
								placeholder="0"
							/>
						</Field>
						<Field label="Status" htmlFor={`${fieldId}-status`}>
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as FinanceProjectStatus)
								}
							>
								<SelectTrigger id={`${fieldId}-status`} aria-label="Status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{STATUS_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>

					<Field label="Bereich" htmlFor={`${fieldId}-tax-area`}>
						<Select value={taxArea} onValueChange={setTaxArea}>
							<SelectTrigger id={`${fieldId}-tax-area`} aria-label="Bereich">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_VALUE}>Ohne Bereich</SelectItem>
								{FINANCE_BEREICH_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{error ? (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
				</div>

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
						disabled={isPending}
						onClick={() => {
							void handleSubmit();
						}}
					>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						Anlegen
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
