import { Check, Loader2, Save } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	note: string | null;
}

interface CategoryMappingEditorSectionProps {
	rows: FinanceCategoryMappingRow[];
	isLoading: boolean;
	error: Error | null;
	savingCostLocationTwo: string | null;
	onSave: (input: SaveInput) => unknown;
}

export function CategoryMappingEditorSection({
	rows,
	isLoading,
	error,
	savingCostLocationTwo,
	onSave,
}: CategoryMappingEditorSectionProps): ReactElement {
	const unlabelledCount = rows.filter((row) => !row.label).length;
	const isSaving = savingCostLocationTwo !== null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Cost center 2 (Kostenstelle 2) → Category
				</CardTitle>
				<CardDescription>
					Assign a clear category to each secondary BuchhaltungsButler cost
					center (Kostenstelle 2), such as Catering, Travel, or Software.
					Unmapped postings appear as "Uncategorized".
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
							{unlabelledCount} of {rows.length} cost centers do not have a
							category yet.
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
									<TableHead className="w-28">
										Cost center 2 (Kostenstelle 2)
									</TableHead>
									<TableHead>Sample postings</TableHead>
									<TableHead className="text-right">Postings</TableHead>
									<TableHead className="text-right">Balance</TableHead>
									<TableHead className="w-56">Category</TableHead>
									<TableHead className="w-10">
										<span className="sr-only">Status</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center text-muted-foreground"
										>
											No cost centers found.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<CategoryRow
											key={row.cost_location_two}
											row={row}
											saving={savingCostLocationTwo === row.cost_location_two}
											disabled={isSaving}
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
	disabled,
	onSave,
}: {
	row: FinanceCategoryMappingRow;
	saving: boolean;
	disabled: boolean;
	onSave: (input: SaveInput) => unknown;
}): ReactElement {
	const [label, setLabel] = useState<string>(row.label ?? "");
	const trimmed = label.trim();
	const isDirty = trimmed !== (row.label ?? "");

	function persist(): void {
		if (!isDirty) {
			return;
		}
		void Promise.resolve(
			onSave({
				costLocationTwo: row.cost_location_two,
				label: trimmed === "" ? null : trimmed,
				note: row.note,
			}),
		).catch(() => undefined);
	}

	return (
		<TableRow>
			<TableCell className="align-top font-medium tabular-nums">
				<div className="flex flex-col gap-1">
					<span>{row.cost_location_two}</span>
					{row.label ? null : (
						<Badge variant="outline" className="w-fit text-amber-600">
							Uncategorized
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
					disabled={disabled}
					placeholder="Enter category"
					aria-label={`Category for cost center 2 (Kostenstelle 2) ${row.cost_location_two}`}
				/>
			</TableCell>
			<TableCell className="w-10 align-middle text-muted-foreground">
				{saving ? (
					<Loader2 aria-label="Save" className="size-4 animate-spin" />
				) : isDirty ? (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={persist}
						disabled={disabled}
						aria-label={`Save category for cost center 2 (Kostenstelle 2) ${row.cost_location_two}`}
					>
						<Save />
					</Button>
				) : row.label ? (
					<Check aria-label="Saved" className="size-4 text-emerald-600" />
				) : null}
			</TableCell>
		</TableRow>
	);
}
