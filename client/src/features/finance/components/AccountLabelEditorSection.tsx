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
import type { FinanceAccountLabelRow } from "@/features/finance/financeTypes";
import {
	formatFinanceAccount,
	formatFinanceAmount,
} from "@/features/finance/financeUtils";

interface SaveInput {
	account: string;
	label: string | null;
	note: string | null;
}

interface AccountLabelEditorSectionProps {
	rows: FinanceAccountLabelRow[];
	isLoading: boolean;
	error: Error | null;
	savingAccount: string | null;
	onSave: (input: SaveInput) => unknown;
}

export function AccountLabelEditorSection({
	rows,
	isLoading,
	error,
	savingAccount,
	onSave,
}: AccountLabelEditorSectionProps): ReactElement {
	const unlabelledCount = rows.filter((row) => !row.label).length;
	const isSaving = savingAccount !== null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Ledger account (Sachkonto) → Label
				</CardTitle>
				<CardDescription>
					Give each SKR03 ledger account (Sachkonto), such as 6810 expense or
					8450 revenue, a clear label. Unlabelled accounts still appear by
					account number.
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
							{unlabelledCount} of {rows.length} accounts do not have a label
							yet.
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
										Ledger account (Sachkonto)
									</TableHead>
									<TableHead>Sample postings</TableHead>
									<TableHead className="text-right">Postings</TableHead>
									<TableHead className="text-right">Balance</TableHead>
									<TableHead className="w-56">Label</TableHead>
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
											No accounts found.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<AccountRow
											key={row.account}
											row={row}
											saving={savingAccount === row.account}
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

function AccountRow({
	row,
	saving,
	disabled,
	onSave,
}: {
	row: FinanceAccountLabelRow;
	saving: boolean;
	disabled: boolean;
	onSave: (input: SaveInput) => unknown;
}): ReactElement {
	const [label, setLabel] = useState<string>(row.label ?? "");
	const trimmed = label.trim();
	const isDirty = trimmed !== (row.label ?? "");
	const displayAccount = formatFinanceAccount(row.account);

	function persist(): void {
		if (!isDirty) {
			return;
		}
		void Promise.resolve(
			onSave({
				account: row.account,
				label: trimmed === "" ? null : trimmed,
				note: row.note,
			}),
		).catch(() => undefined);
	}

	return (
		<TableRow>
			<TableCell className="align-top font-medium tabular-nums">
				<div className="flex flex-col gap-1">
					<span>{displayAccount}</span>
					{row.label ? null : (
						<Badge variant="outline" className="w-fit text-amber-600">
							No label
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
					placeholder="Enter label"
					aria-label={`Label for ledger account (Sachkonto) ${displayAccount}`}
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
						aria-label={`Save label for ledger account (Sachkonto) ${displayAccount}`}
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
