import { Loader2 } from "lucide-react";
import { type ReactElement, useEffect, useId, useState } from "react";
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
	FinanceProject,
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

// Where the node the action was triggered on *suggests* the project should go: a
// sub-team folder presets its sub-team, a project presets itself as the parent
// (FR-L3). Both stay editable in the dialog — a selection collected across
// folders has no node to inherit from, so it must be able to say where it lands
// (FR-L1).
export interface FinanceProjectDialogPreset {
	parentProjectId: string | null;
	subTeam: string | null;
	// Invoices to file into the new project (FR-L1); empty = create an empty
	// folder.
	postingExternalIds: string[];
	selectionSum: number;
}

interface FinanceProjectDialogProps {
	preset: FinanceProjectDialogPreset | null;
	// Candidate parents: the department's projects for this period, already
	// fetched for the "add to project" dialog.
	projects: FinanceProject[];
	// Sub-team folders that exist in this department's T-account, so a project
	// lands in one by exact name instead of a typo'd near-match.
	subTeamOptions: string[];
	isPending: boolean;
	onClose: () => void;
	onSubmit: (input: TAccountProjectInput) => Promise<void>;
}

export function FinanceProjectDialog({
	preset,
	projects,
	subTeamOptions,
	isPending,
	onClose,
	onSubmit,
}: FinanceProjectDialogProps): ReactElement {
	const fieldId = useId();
	const [name, setName] = useState("");
	const [targetAmount, setTargetAmount] = useState("");
	const [status, setStatus] = useState<FinanceProjectStatus>("active");
	const [taxArea, setTaxArea] = useState<string>(NO_VALUE);
	const [parentProjectId, setParentProjectId] = useState<string>(NO_VALUE);
	const [subTeam, setSubTeam] = useState<string>(NO_VALUE);
	const [error, setError] = useState<string | null>(null);

	// Adopt the node's placement every time the dialog opens: the preset is the
	// starting point, not the verdict.
	useEffect(() => {
		if (preset === null) return;
		setParentProjectId(preset.parentProjectId ?? NO_VALUE);
		setSubTeam(preset.subTeam ?? NO_VALUE);
	}, [preset]);

	const isSubProject = parentProjectId !== NO_VALUE;
	const selectionCount = preset?.postingExternalIds.length ?? 0;
	// A sub-team the data still carries but that has no folder of its own yet
	// (e.g. the preset's) must stay selectable.
	const subTeamChoices = [
		...new Set(
			[...subTeamOptions, preset?.subTeam, subTeam]
				.filter((option): option is string => Boolean(option))
				.filter((option) => option !== NO_VALUE),
		),
	].sort((left, right) => left.localeCompare(right, "de"));

	function reset(): void {
		setName("");
		setTargetAmount("");
		setStatus("active");
		setTaxArea(NO_VALUE);
		setParentProjectId(NO_VALUE);
		setSubTeam(NO_VALUE);
		setError(null);
	}

	// A sub-project lives inside its parent's folder, so it inherits the parent's
	// sub-team by default — still editable, since only the server's cycle/scope
	// guards are authoritative.
	function handleParentChange(value: string): void {
		setParentProjectId(value);
		const parent = projects.find((project) => project.id === value);
		if (parent) {
			setSubTeam(parent.sub_team ?? NO_VALUE);
		}
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
			parentProjectId: parentProjectId === NO_VALUE ? null : parentProjectId,
			subTeam: subTeam === NO_VALUE ? null : subTeam,
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

					{/* Placement (FR-L1/FR-L3/FR-L4): prefilled from the folder the
					    action was started in, editable because a selection spanning
					    folders has no folder to inherit from. */}
					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							label="Übergeordnetes Projekt"
							htmlFor={`${fieldId}-parent`}
							description="Leer = eigenständiges Projekt."
						>
							<Select
								value={parentProjectId}
								onValueChange={handleParentChange}
							>
								<SelectTrigger
									id={`${fieldId}-parent`}
									aria-label="Übergeordnetes Projekt"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_VALUE}>
										Ohne übergeordnetes Projekt
									</SelectItem>
									{projects.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field
							label="Sub-Team"
							htmlFor={`${fieldId}-sub-team`}
							description="Bestimmt, in welchem Ordner das Projekt hängt."
						>
							<Select value={subTeam} onValueChange={setSubTeam}>
								<SelectTrigger id={`${fieldId}-sub-team`} aria-label="Sub-Team">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_VALUE}>Ohne Sub-Team</SelectItem>
									{subTeamChoices.map((option) => (
										<SelectItem key={option} value={option}>
											{option}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>

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
