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
import type { FinanceCategoryMappingRow } from "@/features/finance/financeTypes";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

interface SaveInput {
	costLocationTwo: string;
	label: string | null;
}

interface CategoryMappingEditorSectionProps {
	rows: FinanceCategoryMappingRow[];
	isLoading: boolean;
	error: Error | null;
	savingCostLocationTwo: string | null;
	onSave: (input: SaveInput) => void;
}

export function CategoryMappingEditorSection({
	rows,
	isLoading,
	error,
	savingCostLocationTwo,
	onSave,
}: CategoryMappingEditorSectionProps): ReactElement {
	const unlabelledCount = rows.filter((row) => !row.label).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Kostenstelle 2 → Kategorie</CardTitle>
				<CardDescription>
					Gib jeder zweiten BuchhaltungsButler-Kostenstelle eine sprechende
					Kategorie (z. B. Catering, Reise, Software). Buchungen ohne Kategorie
					landen in der Auswertung unter „Ohne Kategorie".
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
							{unlabelledCount} von {rows.length} Kostenstellen haben noch keine
							Kategorie.
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
									<TableHead className="w-28">Kostenstelle 2</TableHead>
									<TableHead>Beispiel-Buchungen</TableHead>
									<TableHead className="text-right">Buchungen</TableHead>
									<TableHead className="text-right">Saldo</TableHead>
									<TableHead className="w-56">Kategorie</TableHead>
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
											Keine Kostenstellen gefunden.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<CategoryRow
											key={row.cost_location_two}
											row={row}
											saving={savingCostLocationTwo === row.cost_location_two}
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

function CategoryRow({
	row,
	saving,
	onSave,
}: {
	row: FinanceCategoryMappingRow;
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
			costLocationTwo: row.cost_location_two,
			label: trimmed === "" ? null : trimmed,
		});
	}

	return (
		<TableRow>
			<TableCell className="align-top font-medium tabular-nums">
				<div className="flex flex-col gap-1">
					<span>{row.cost_location_two}</span>
					{row.label ? null : (
						<Badge variant="outline" className="w-fit text-amber-600">
							Ohne Kategorie
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
					placeholder="Kategorie eingeben"
					aria-label={`Kategorie für Kostenstelle 2 ${row.cost_location_two}`}
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
