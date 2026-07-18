import { Check, Loader2 } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { FinanceAccountLabelRow } from "@/features/finance/financeTypes";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

interface SaveInput {
	account: string;
	label: string | null;
}

interface AccountLabelEditorSectionProps {
	rows: FinanceAccountLabelRow[];
	isLoading: boolean;
	error: Error | null;
	savingAccount: string | null;
	onSave: (input: SaveInput) => void;
}

export function AccountLabelEditorSection({
	rows,
	isLoading,
	error,
	savingAccount,
	onSave,
}: AccountLabelEditorSectionProps): ReactElement {
	const unlabelledCount = rows.filter((row) => !row.label).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Konto → Bezeichnung</CardTitle>
				<CardDescription>
					Gib jedem SKR03-Sachkonto (z. B. 6810 Aufwand, 8450 Erlös) eine
					sprechende Bezeichnung. Nicht benannte Konten erscheinen in der
					Auswertung weiterhin mit ihrer Kontonummer.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}

				{!isLoading && unlabelledCount > 0 ? (
					<Alert>
						<AlertDescription>
							{unlabelledCount} von {rows.length} Konten haben noch keine
							Bezeichnung.
						</AlertDescription>
					</Alert>
				) : null}

				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-28">Konto</TableHead>
									<TableHead>Beispiel-Buchungen</TableHead>
									<TableHead className="text-right">Buchungen</TableHead>
									<TableHead className="text-right">Saldo</TableHead>
									<TableHead className="w-56">Bezeichnung</TableHead>
									<TableHead className="w-10" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center text-muted-foreground"
										>
											Keine Konten gefunden.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<AccountRow
											key={row.account}
											row={row}
											saving={savingAccount === row.account}
											onSave={onSave}
										/>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function AccountRow({
	row,
	saving,
	onSave,
}: {
	row: FinanceAccountLabelRow;
	saving: boolean;
	onSave: (input: SaveInput) => void;
}): ReactElement {
	const [label, setLabel] = useState<string>(row.label ?? "");

	// Persist on blur / Enter, but only when the trimmed label actually changed
	// so tabbing through the table doesn't fire redundant saves.
	function persist(): void {
		const trimmed = label.trim();
		if (trimmed === (row.label ?? "")) {
			return;
		}
		onSave({
			account: row.account,
			label: trimmed === "" ? null : trimmed,
		});
	}

	return (
		<TableRow>
			<TableCell className="align-top font-medium tabular-nums">
				<div className="flex flex-col gap-1">
					<span>{row.account}</span>
					{row.label ? null : (
						<Badge variant="outline" className="w-fit text-amber-600">
							Ohne Bezeichnung
						</Badge>
					)}
				</div>
			</TableCell>
			<TableCell className="align-top text-sm text-muted-foreground">
				<span
					className="block max-w-xs truncate"
					title={row.sample_texts.join(" · ")}
				>
					{row.sample_texts.join(" · ") || "—"}
				</span>
			</TableCell>
			<TableCell className="align-top text-right tabular-nums">
				{row.posting_count}
			</TableCell>
			<TableCell className="align-top text-right tabular-nums">
				{formatFinanceAmount(row.net)}
			</TableCell>
			<TableCell className="align-top">
				<Input
					value={label}
					onChange={(event) => setLabel(event.target.value)}
					onBlur={persist}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.currentTarget.blur();
						}
					}}
					placeholder="Bezeichnung eingeben"
					aria-label={`Bezeichnung für Konto ${row.account}`}
				/>
			</TableCell>
			<TableCell className="w-10 align-middle text-muted-foreground">
				{saving ? (
					<Loader2 aria-label="Speichern" className="size-4 animate-spin" />
				) : row.label ? (
					<Check aria-label="Gespeichert" className="size-4 text-emerald-600" />
				) : null}
			</TableCell>
		</TableRow>
	);
}
