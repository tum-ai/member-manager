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
import { Textarea } from "@/components/ui/textarea";
import type {
	FinancePlanDirection,
	FinancePlanStatus,
} from "@/features/finance/financeTypes";
import type { TAccountPlanItemInput } from "@/features/finance/hooks/useFinanceTAccountPlanActions";

const STATUS_OPTIONS: ReadonlyArray<{
	value: FinancePlanStatus;
	label: string;
}> = [
	{ value: "planned", label: "Geplant" },
	{ value: "committed", label: "Zugesagt" },
	{ value: "spent", label: "Ausgegeben" },
];

// What the node (or the line) the dialog was opened from already decides. A
// create presets the project from its folder (FR-M1); an edit carries the
// Planposten's current values (FR-M2).
export interface FinancePlanItemDialogPreset {
	id: string | null;
	projectId: string | null;
	folderName: string | null;
	label: string;
	category: string | null;
	direction: FinancePlanDirection;
	plannedAmount: number;
	expectedMonth: string | null;
	status: FinancePlanStatus;
	note: string | null;
	vatRate: number | null;
	// A Planposten with postings matched to it cannot change direction, and the
	// planned amount cannot go below what is already matched — the server
	// enforces both; saying so up front beats a rejected save.
	matchedAmount: number;
}

interface FinancePlanItemDialogProps {
	preset: FinancePlanItemDialogPreset | null;
	isPending: boolean;
	onClose: () => void;
	onSubmit: (input: TAccountPlanItemInput) => Promise<void>;
}

export function FinancePlanItemDialog({
	preset,
	isPending,
	onClose,
	onSubmit,
}: FinancePlanItemDialogProps): ReactElement {
	const fieldId = useId();
	const [label, setLabel] = useState("");
	const [category, setCategory] = useState("");
	const [direction, setDirection] = useState<FinancePlanDirection>("expense");
	const [plannedAmount, setPlannedAmount] = useState("");
	const [expectedMonth, setExpectedMonth] = useState("");
	const [status, setStatus] = useState<FinancePlanStatus>("planned");
	const [vatRate, setVatRate] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);

	// Adopt the preset whenever a different Planposten (or a fresh create) opens
	// the dialog, so an edit starts from the item's own values.
	useEffect(() => {
		if (preset === null) return;
		setLabel(preset.label);
		setCategory(preset.category ?? "");
		setDirection(preset.direction);
		setPlannedAmount(
			preset.plannedAmount === 0 ? "" : String(preset.plannedAmount),
		);
		setExpectedMonth(preset.expectedMonth ?? "");
		setStatus(preset.status);
		setVatRate(preset.vatRate === null ? "" : String(preset.vatRate));
		setNote(preset.note ?? "");
		setError(null);
	}, [preset]);

	const isEdit = preset?.id != null;
	const hasMatches = (preset?.matchedAmount ?? 0) > 0;

	async function handleSubmit(): Promise<void> {
		const trimmed = label.trim();
		if (trimmed === "") {
			setError("Bitte eine Bezeichnung angeben.");
			return;
		}
		const amount = Number(plannedAmount);
		if (plannedAmount.trim() === "" || Number.isNaN(amount) || amount < 0) {
			setError("Betrag muss eine Zahl ≥ 0 sein.");
			return;
		}
		if (hasMatches && amount < (preset?.matchedAmount ?? 0)) {
			setError(
				"Der Betrag kann nicht unter den bereits zugeordneten Ist-Betrag fallen.",
			);
			return;
		}
		const rate = vatRate.trim() === "" ? null : Number(vatRate);
		if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
			setError("Steuersatz muss zwischen 0 und 100 liegen.");
			return;
		}
		setError(null);
		await onSubmit({
			id: preset?.id ?? null,
			label: trimmed,
			category: category.trim() === "" ? null : category.trim(),
			direction,
			plannedAmount: amount,
			expectedMonth: expectedMonth.trim() === "" ? null : expectedMonth.trim(),
			status,
			note: note.trim() === "" ? null : note.trim(),
			vatRate: rate,
			projectId: preset?.projectId ?? null,
		});
	}

	return (
		<Dialog
			open={preset !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Planposten bearbeiten" : "Neuer Planposten"}
					</DialogTitle>
					<DialogDescription>
						{preset?.folderName
							? `Wird in „${preset.folderName}" geführt.`
							: "Wird direkt am Department geführt."}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					<Field label="Bezeichnung" htmlFor={`${fieldId}-label`} required>
						<Input
							id={`${fieldId}-label`}
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							placeholder="z. B. Venue-Miete"
						/>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Betrag (€)" htmlFor={`${fieldId}-amount`} required>
							<Input
								id={`${fieldId}-amount`}
								type="number"
								inputMode="decimal"
								value={plannedAmount}
								onChange={(event) => setPlannedAmount(event.target.value)}
							/>
						</Field>
						<Field
							label="Richtung"
							htmlFor={`${fieldId}-direction`}
							description={
								hasMatches
									? "Nicht änderbar, solange Buchungen zugeordnet sind."
									: undefined
							}
						>
							<Select
								value={direction}
								disabled={hasMatches}
								onValueChange={(value) =>
									setDirection(value as FinancePlanDirection)
								}
							>
								<SelectTrigger
									id={`${fieldId}-direction`}
									aria-label="Richtung"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="expense">Ausgabe</SelectItem>
									<SelectItem value="income">Einnahme</SelectItem>
								</SelectContent>
							</Select>
						</Field>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Status" htmlFor={`${fieldId}-status`}>
							<Select
								value={status}
								onValueChange={(value) => setStatus(value as FinancePlanStatus)}
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
						<Field label="Erwarteter Monat" htmlFor={`${fieldId}-month`}>
							<Input
								id={`${fieldId}-month`}
								type="month"
								value={expectedMonth}
								onChange={(event) => setExpectedMonth(event.target.value)}
							/>
						</Field>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Kategorie" htmlFor={`${fieldId}-category`}>
							<Input
								id={`${fieldId}-category`}
								value={category}
								onChange={(event) => setCategory(event.target.value)}
							/>
						</Field>
						<Field
							label="Steuersatz (%)"
							htmlFor={`${fieldId}-vat`}
							description="Leer lassen, wenn unbekannt."
						>
							<Input
								id={`${fieldId}-vat`}
								type="number"
								inputMode="decimal"
								value={vatRate}
								onChange={(event) => setVatRate(event.target.value)}
								placeholder="19"
							/>
						</Field>
					</div>

					<Field label="Notiz" htmlFor={`${fieldId}-note`}>
						<Textarea
							id={`${fieldId}-note`}
							rows={2}
							value={note}
							onChange={(event) => setNote(event.target.value)}
						/>
					</Field>

					{error ? (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
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
						{isEdit ? "Speichern" : "Anlegen"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
