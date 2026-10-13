import type { DoorPinImportResult } from "@member-manager/shared";
import { KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { InfoBox } from "@/components/ui/info-box";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
	DOOR_PIN_REJECTION_LABELS,
	DOOR_PIN_SKIP_LABELS,
	type DoorPinSheetSkippedRow,
} from "@/features/admin/doorPinImportUtils";
import type { AdminDoorPinImportState } from "@/features/admin/hooks/useAdminDoorPinImport";

const FILE_INPUT_ID = "door-pin-import-file";

interface ListedRow {
	key: string;
	primary: string;
	secondary: string;
}

function rowLabel(row: { row_number: number; name: string; email: string }) {
	return `Row ${row.row_number} · ${row.name || "No name"}`;
}

function RowList({
	title,
	hint,
	rows,
}: {
	title: string;
	hint: string;
	rows: ListedRow[];
}) {
	if (rows.length === 0) return null;
	return (
		<details className="rounded-lg border border-border">
			<summary className="cursor-pointer px-3 py-2 text-sm font-medium">
				{title} ({rows.length})
			</summary>
			<div className="border-t border-border px-3 py-2">
				<p className="mb-2 text-xs text-muted-foreground">{hint}</p>
				<ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
					{rows.map((row) => (
						<li key={row.key} className="flex flex-col">
							<span>{row.primary}</span>
							<span className="text-xs break-all text-muted-foreground">
								{row.secondary}
							</span>
						</li>
					))}
				</ul>
			</div>
		</details>
	);
}

function Count({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border border-border bg-muted/30 p-3">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="text-xl font-semibold tabular-nums">{value}</dd>
		</div>
	);
}

function ImportSummary({
	result,
	skipped,
}: {
	result: DoorPinImportResult;
	skipped: DoorPinSheetSkippedRow[];
}) {
	const verb = result.dry_run ? "Will be" : "Were";
	return (
		<div className="grid gap-4">
			<dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Count label={`${verb} added`} value={result.created} />
				<Count label={`${verb} changed`} value={result.updated} />
				<Count label="Already up to date" value={result.unchanged} />
				<Count
					label="Not imported"
					value={result.unmatched.length + result.rejected.length}
				/>
			</dl>

			<div className="grid gap-2">
				<RowList
					title="No member account with this email"
					hint="Their login email differs from the sheet, or they have no account yet. Set their PIN by hand in the member editor."
					rows={result.unmatched.map((row) => ({
						key: `unmatched-${row.row_number}`,
						primary: rowLabel(row),
						secondary: row.email,
					}))}
				/>
				<RowList
					title="Rejected rows"
					hint="Fix these in the sheet (and the cabinet), then import again."
					rows={result.rejected.map((row) => ({
						key: `rejected-${row.row_number}`,
						primary: rowLabel(row),
						secondary: `${DOOR_PIN_REJECTION_LABELS[row.reason]}${row.email ? ` · ${row.email}` : ""}`,
					}))}
				/>
				<RowList
					title="Skipped in the sheet"
					hint="These rows aren't member PINs and were not sent."
					rows={skipped.map((row) => ({
						key: `skipped-${row.row_number}`,
						primary: rowLabel(row),
						secondary: `${DOOR_PIN_SKIP_LABELS[row.reason]}${row.email ? ` · ${row.email}` : ""}`,
					}))}
				/>
				<RowList
					title="Active members still without a PIN"
					hint="Not in the sheet or not matched. Add them to the cabinet, then set their PIN here."
					rows={result.members_without_pin.map((member) => ({
						key: `missing-${member.user_id}`,
						primary: member.name || "No name",
						secondary: member.email || member.user_id,
					}))}
				/>
			</div>
		</div>
	);
}

/**
 * Import the key cabinet's user sheet: pick the .xlsx, review the dry run,
 * apply. Never shows a PIN.
 */
export function AdminDoorPinImportDialog({
	isOpen,
	closeDialog,
	step,
	fileName,
	selectFile,
	isReadingFile,
	isApplying,
	fileError,
	skipped,
	result,
	pendingChanges,
	applyImport,
}: AdminDoorPinImportState) {
	let body: ReactNode = null;
	if (isReadingFile) {
		body = (
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<Spinner className="size-4" />
				Reading {fileName} and checking it against member accounts…
			</p>
		);
	} else if (fileError) {
		body = (
			<InfoBox variant="destructive" className="text-sm" role="alert">
				{fileError}
			</InfoBox>
		);
	} else if (result) {
		body = <ImportSummary result={result} skipped={skipped} />;
	}

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) closeDialog();
			}}
		>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<KeyRound className="size-5 text-brand" aria-hidden="true" />
						Import door PINs
					</DialogTitle>
					<DialogDescription>
						Upload the Traka21 user sheet (.xlsx). Rows are matched to members
						by the email in Kontakt. You'll see what changes before anything is
						saved, and members not in the sheet keep their PIN.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					{step !== "done" && (
						<div className="grid gap-1.5">
							<Label htmlFor={FILE_INPUT_ID}>Traka21 sheet</Label>
							<Input
								id={FILE_INPUT_ID}
								type="file"
								accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
								disabled={isReadingFile || isApplying}
								onChange={(event) => {
									const file = event.target.files?.[0];
									event.target.value = "";
									void selectFile(file);
								}}
							/>
						</div>
					)}
					{step === "done" && (
						<InfoBox variant="brand" className="text-sm" role="status">
							Imported. Members see their PIN on their profile once they've
							finished the welcome steps.
						</InfoBox>
					)}
					{body}
				</div>

				<DialogFooter>
					{step === "done" ? (
						<Button type="button" onClick={closeDialog}>
							Done
						</Button>
					) : (
						<>
							<Button
								type="button"
								variant="ghost"
								onClick={closeDialog}
								disabled={isApplying}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => void applyImport()}
								disabled={
									step !== "preview" || pendingChanges === 0 || isApplying
								}
							>
								{isApplying
									? "Importing..."
									: pendingChanges === 1
										? "Apply 1 PIN"
										: `Apply ${pendingChanges} PINs`}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
