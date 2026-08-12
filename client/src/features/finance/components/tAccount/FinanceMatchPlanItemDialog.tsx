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
import { formatFinanceAmount } from "@/features/finance/financeUtils";
import type { TAccountMatchInput } from "@/features/finance/hooks/useFinanceTAccountPlanActions";

export interface FinanceMatchCandidate {
	id: string;
	label: string;
	// What is still open on that candidate, used to cap the suggested amount.
	openAmount: number;
}

// FR-M5. The same dialog serves both directions: whichever side the user
// expanded is fixed, the other is picked from candidates of the same direction.
export interface FinanceMatchDialogPreset {
	// The side the action was started from.
	from: "posting" | "planItem";
	postingExternalId: string | null;
	planItemId: string | null;
	fixedLabel: string;
	// Open remainder of the fixed side — the sensible default amount.
	openAmount: number;
	candidates: FinanceMatchCandidate[];
}

interface FinanceMatchPlanItemDialogProps {
	preset: FinanceMatchDialogPreset | null;
	isPending: boolean;
	onClose: () => void;
	onSubmit: (input: TAccountMatchInput) => Promise<void>;
}

export function FinanceMatchPlanItemDialog({
	preset,
	isPending,
	onClose,
	onSubmit,
}: FinanceMatchPlanItemDialogProps): ReactElement {
	const fieldId = useId();
	const [candidateId, setCandidateId] = useState("");
	const [amount, setAmount] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (preset === null) return;
		setCandidateId("");
		setAmount(String(preset.openAmount));
		setError(null);
	}, [preset]);

	const fromPosting = preset?.from === "posting";
	const candidateLabel = fromPosting ? "Planposten" : "Buchung";

	function pickCandidate(nextId: string): void {
		setCandidateId(nextId);
		// Default to whatever is open on the smaller of the two sides, so the
		// common "this invoice settles this Planposten" case needs no arithmetic.
		const candidate = preset?.candidates.find((entry) => entry.id === nextId);
		if (candidate && preset) {
			setAmount(String(Math.min(candidate.openAmount, preset.openAmount)));
		}
	}

	async function handleSubmit(): Promise<void> {
		if (candidateId === "") {
			setError(
				`Bitte ${candidateLabel === "Buchung" ? "eine" : "einen"} ${candidateLabel} wählen.`,
			);
			return;
		}
		const parsed = Number(amount);
		if (amount.trim() === "" || Number.isNaN(parsed) || parsed <= 0) {
			setError("Betrag muss größer als 0 sein.");
			return;
		}
		setError(null);
		await onSubmit({
			planItemId: fromPosting ? candidateId : (preset?.planItemId ?? ""),
			postingExternalId: fromPosting
				? (preset?.postingExternalId ?? "")
				: candidateId,
			matchedAmount: parsed,
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
						{fromPosting ? "Planposten zuordnen" : "Buchung zuordnen"}
					</DialogTitle>
					<DialogDescription>
						{preset?.fixedLabel} · offen{" "}
						{formatFinanceAmount(preset?.openAmount ?? 0)}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					<Field
						label={candidateLabel}
						htmlFor={`${fieldId}-candidate`}
						required
					>
						{preset && preset.candidates.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								{fromPosting
									? "Für diese Richtung gibt es keinen aktiven Planposten im Zeitraum."
									: "Für diese Richtung gibt es keine offene Buchung im Zeitraum."}
							</p>
						) : (
							<Select value={candidateId} onValueChange={pickCandidate}>
								<SelectTrigger
									id={`${fieldId}-candidate`}
									aria-label={candidateLabel}
								>
									<SelectValue placeholder={`${candidateLabel} wählen`} />
								</SelectTrigger>
								<SelectContent>
									{(preset?.candidates ?? []).map((candidate) => (
										<SelectItem key={candidate.id} value={candidate.id}>
											{candidate.label} ·{" "}
											{formatFinanceAmount(candidate.openAmount)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</Field>

					<Field
						label="Betrag (€)"
						htmlFor={`${fieldId}-amount`}
						description="Teilbeträge sind erlaubt; voreingestellt ist der offene Rest."
						required
					>
						<Input
							id={`${fieldId}-amount`}
							type="number"
							inputMode="decimal"
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
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
						disabled={isPending || (preset?.candidates.length ?? 0) === 0}
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
