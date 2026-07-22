import { TUMAI_DEPARTMENTS } from "@member-manager/shared";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	FinanceBereich,
	FinanceDepartmentMappingRow,
} from "@/features/finance/financeTypes";
import {
	FINANCE_BEREICH_OPTIONS,
	formatFinanceAmount,
} from "@/features/finance/financeUtils";

const NO_BEREICH_VALUE = "__none__";
const NO_DEPARTMENT_VALUE = "__none__";
// Catch-all department for cost locations that don't fit any real department.
const OTHER_DEPARTMENT = "Other";
const DEPARTMENT_OPTIONS = [...TUMAI_DEPARTMENTS, OTHER_DEPARTMENT] as const;

interface SaveInput {
	costLocation: string;
	department: string | null;
	bereich: FinanceBereich | null;
	note: string | null;
}

interface DepartmentMappingEditorSectionProps {
	rows: FinanceDepartmentMappingRow[];
	isLoading: boolean;
	error: Error | null;
	savingCostLocation: string | null;
	onSave: (input: SaveInput) => unknown;
}

export function DepartmentMappingEditorSection({
	rows,
	isLoading,
	error,
	savingCostLocation,
	onSave,
}: DepartmentMappingEditorSectionProps): ReactElement {
	const unassignedCount = rows.filter((row) => !row.department).length;
	const isSaving = savingCostLocation !== null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Cost locations → Department</CardTitle>
				<CardDescription>
					Assign each BuchhaltungsButler cost location to a department and tax
					realm. Unassigned cost locations are highlighted and appear as
					"Unassigned" in analytics.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}

				{!isLoading && unassignedCount > 0 ? (
					<Alert>
						<AlertDescription>
							{unassignedCount} of {rows.length} cost locations are still
							unassigned.
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
									<TableHead className="w-28">Cost location</TableHead>
									<TableHead>Sample postings</TableHead>
									<TableHead className="text-right">Postings</TableHead>
									<TableHead className="text-right">Balance</TableHead>
									<TableHead className="w-48">Department</TableHead>
									<TableHead className="w-56">Tax realm</TableHead>
									<TableHead className="w-10">
										<span className="sr-only">Status</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="text-center text-muted-foreground"
										>
											No cost locations found.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<MappingRow
											key={row.cost_location}
											row={row}
											saving={savingCostLocation === row.cost_location}
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

function MappingRow({
	row,
	saving,
	disabled,
	onSave,
}: {
	row: FinanceDepartmentMappingRow;
	saving: boolean;
	disabled: boolean;
	onSave: (input: SaveInput) => unknown;
}): ReactElement {
	const [department, setDepartment] = useState<string>(
		row.department ?? NO_DEPARTMENT_VALUE,
	);
	const [bereich, setBereich] = useState<string>(
		row.bereich ?? NO_BEREICH_VALUE,
	);

	const persistedDepartment = row.department ?? NO_DEPARTMENT_VALUE;
	const persistedBereich = row.bereich ?? NO_BEREICH_VALUE;
	const isDirty =
		department !== persistedDepartment || bereich !== persistedBereich;

	function persist(): void {
		void Promise.resolve(
			onSave({
				costLocation: row.cost_location,
				department: department === NO_DEPARTMENT_VALUE ? null : department,
				bereich:
					bereich === NO_BEREICH_VALUE ? null : (bereich as FinanceBereich),
				note: row.note,
			}),
		).catch(() => undefined);
	}

	function handleDepartmentChange(value: string): void {
		setDepartment(value);
	}

	function handleBereichChange(value: string): void {
		setBereich(value);
	}

	return (
		<TableRow>
			<TableCell className="align-top font-medium tabular-nums">
				<div className="flex flex-col gap-1">
					<span>{row.cost_location}</span>
					{row.department ? null : (
						<Badge variant="outline" className="w-fit text-amber-600">
							Unassigned
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
				<Select
					value={department}
					onValueChange={handleDepartmentChange}
					disabled={disabled}
				>
					<SelectTrigger
						aria-label={`Department for cost location ${row.cost_location}`}
					>
						<SelectValue placeholder="Select department" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_DEPARTMENT_VALUE}>Unassigned</SelectItem>
						{DEPARTMENT_OPTIONS.map((dept) => (
							<SelectItem key={dept} value={dept}>
								{dept}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell className="align-top">
				<Select
					value={bereich}
					onValueChange={handleBereichChange}
					disabled={disabled}
				>
					<SelectTrigger
						aria-label={`Tax realm for cost location ${row.cost_location}`}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_BEREICH_VALUE}>No tax realm</SelectItem>
						{FINANCE_BEREICH_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
						aria-label={`Save mapping for cost location ${row.cost_location}`}
					>
						<Save />
					</Button>
				) : row.department ? (
					<Check aria-label="Saved" className="size-4 text-emerald-600" />
				) : null}
			</TableCell>
		</TableRow>
	);
}
