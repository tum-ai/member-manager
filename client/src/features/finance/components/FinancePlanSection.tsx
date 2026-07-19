import { TUMAI_DEPARTMENTS } from "@member-manager/shared";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
	FinancePeriodType,
	FinancePlanItem,
	FinancePlanItemsResponse,
	FinancePlanStatus,
} from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	formatFinanceAmount,
	formatFinancePeriodLabel,
	listFinancePeriodKeys,
} from "@/features/finance/financeUtils";
import type {
	PlanItemCreateInput,
	PlanItemUpdateInput,
} from "@/features/finance/hooks/useFinancePlanItems";

const STATUS_LABELS: Record<FinancePlanStatus, string> = {
	planned: "Geplant",
	committed: "Zugesagt",
	spent: "Ausgegeben",
};
const STATUS_ORDER: FinancePlanStatus[] = ["planned", "committed", "spent"];
const OTHER_DEPARTMENT = "Other";
const DEPARTMENT_OPTIONS = [...TUMAI_DEPARTMENTS, OTHER_DEPARTMENT] as const;

interface FinancePlanSectionProps {
	period: FinancePeriod;
	items: FinancePlanItem[];
	totals?: FinancePlanItemsResponse["totals"];
	isLoading: boolean;
	error: Error | null;
	// Reviewers pick the department; scoped members plan for their own only.
	canChooseDepartment: boolean;
	department: string | null;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
	onCreate: (input: PlanItemCreateInput) => void;
	onUpdate: (input: PlanItemUpdateInput) => void;
	onDelete: (id: string) => void;
}

export function FinancePlanSection({
	period,
	items,
	totals,
	isLoading,
	error,
	canChooseDepartment,
	department,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onCreate,
	onUpdate,
	onDelete,
}: FinancePlanSectionProps): ReactElement {
	const overCommitted = (totals?.planned ?? 0) > (totals?.budget ?? 0);

	return (
		<div className="flex flex-col gap-5">
			<PeriodControls
				period={period}
				onPeriodTypeChange={onPeriodTypeChange}
				onPeriodKeyChange={onPeriodKeyChange}
			/>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			{!isLoading && overCommitted ? (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />
					<AlertDescription>
						Die Planung ({formatFinanceAmount(totals?.planned ?? 0)}) übersteigt
						das Budget ({formatFinanceAmount(totals?.budget ?? 0)}).
					</AlertDescription>
				</Alert>
			) : null}

			<TotalsRow totals={totals} isLoading={isLoading} />

			<AddPlanItemForm
				canChooseDepartment={canChooseDepartment}
				department={department}
				onCreate={onCreate}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Planposten — {formatFinancePeriodLabel(period)}
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<Skeleton className="h-48 w-full" />
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Bezeichnung</TableHead>
										{canChooseDepartment ? (
											<TableHead>Department</TableHead>
										) : null}
										<TableHead>Kategorie</TableHead>
										<TableHead className="text-right">Betrag</TableHead>
										<TableHead>Monat</TableHead>
										<TableHead className="w-40">Status</TableHead>
										<TableHead className="w-10" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={canChooseDepartment ? 7 : 6}
												className="text-center text-muted-foreground"
											>
												Noch keine Planposten im Zeitraum.
											</TableCell>
										</TableRow>
									) : (
										items.map((item) => (
											<PlanItemRow
												key={item.id}
												item={item}
												showDepartment={canChooseDepartment}
												onUpdate={onUpdate}
												onDelete={onDelete}
											/>
										))
									)}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function PeriodControls({
	period,
	onPeriodTypeChange,
	onPeriodKeyChange,
}: {
	period: FinancePeriod;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
}): ReactElement {
	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-plan-type">Zeitraumtyp</Label>
				<Select
					value={period.type}
					onValueChange={(value) =>
						onPeriodTypeChange(value as FinancePeriodType)
					}
				>
					<SelectTrigger id="finance-plan-type" className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="year">Jahr</SelectItem>
						<SelectItem value="semester">Semester</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-plan-period">Zeitraum</Label>
				<Select value={period.key} onValueChange={onPeriodKeyChange}>
					<SelectTrigger id="finance-plan-period" className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{listFinancePeriodKeys(period.type).map((key) => (
							<SelectItem key={key} value={key}>
								{formatFinancePeriodLabel({ type: period.type, key })}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

function TotalsRow({
	totals,
	isLoading,
}: {
	totals?: FinancePlanItemsResponse["totals"];
	isLoading: boolean;
}): ReactElement {
	const metrics = [
		{ label: "Geplant", value: totals?.planned ?? 0 },
		{ label: "Budget", value: totals?.budget ?? 0 },
		{ label: "Ist", value: totals?.actual ?? 0 },
	];

	return (
		<section
			aria-label="Plankennzahlen"
			className="grid grid-cols-1 gap-4 sm:grid-cols-3"
		>
			{metrics.map((metric) => (
				<Card key={metric.label}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{metric.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-8 w-28" />
						) : (
							<p className="text-2xl font-semibold tabular-nums">
								{formatFinanceAmount(metric.value)}
							</p>
						)}
					</CardContent>
				</Card>
			))}
		</section>
	);
}

function AddPlanItemForm({
	canChooseDepartment,
	department,
	onCreate,
}: {
	canChooseDepartment: boolean;
	department: string | null;
	onCreate: (input: PlanItemCreateInput) => void;
}): ReactElement {
	const [label, setLabel] = useState("");
	const [category, setCategory] = useState("");
	const [amount, setAmount] = useState("");
	const [month, setMonth] = useState("");
	const [status, setStatus] = useState<FinancePlanStatus>("planned");
	const [dept, setDept] = useState<string>(
		canChooseDepartment ? "" : (department ?? ""),
	);

	const targetDepartment = canChooseDepartment ? dept : (department ?? "");
	const parsedAmount = amount.trim() === "" ? Number.NaN : Number(amount);
	const canSubmit =
		label.trim() !== "" &&
		Number.isFinite(parsedAmount) &&
		parsedAmount >= 0 &&
		targetDepartment !== "";

	function submit(): void {
		if (!canSubmit) {
			return;
		}
		onCreate({
			department: targetDepartment,
			label: label.trim(),
			category: category.trim() === "" ? null : category.trim(),
			plannedAmount: parsedAmount,
			expectedMonth: month === "" ? null : month,
			status,
		});
		setLabel("");
		setCategory("");
		setAmount("");
		setMonth("");
		setStatus("planned");
		if (canChooseDepartment) {
			setDept("");
		}
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Planposten hinzufügen</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap items-end gap-3">
					{canChooseDepartment ? (
						<div className="flex flex-col gap-1">
							<Label htmlFor="plan-dept">Department</Label>
							<Select value={dept} onValueChange={setDept}>
								<SelectTrigger id="plan-dept" className="w-44">
									<SelectValue placeholder="Wählen" />
								</SelectTrigger>
								<SelectContent>
									{DEPARTMENT_OPTIONS.map((option) => (
										<SelectItem key={option} value={option}>
											{option}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<div className="flex flex-col gap-1">
						<Label htmlFor="plan-label">Bezeichnung</Label>
						<Input
							id="plan-label"
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							placeholder="z. B. Venue"
							className="w-44"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="plan-category">Kategorie</Label>
						<Input
							id="plan-category"
							value={category}
							onChange={(event) => setCategory(event.target.value)}
							placeholder="optional"
							className="w-36"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="plan-amount">Betrag (€)</Label>
						<Input
							id="plan-amount"
							type="number"
							min={0}
							inputMode="decimal"
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
							className="w-32 text-right tabular-nums"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="plan-month">Monat</Label>
						<Input
							id="plan-month"
							type="month"
							value={month}
							onChange={(event) => setMonth(event.target.value)}
							className="w-40"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="plan-status">Status</Label>
						<Select
							value={status}
							onValueChange={(value) => setStatus(value as FinancePlanStatus)}
						>
							<SelectTrigger id="plan-status" className="w-36">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{STATUS_ORDER.map((value) => (
									<SelectItem key={value} value={value}>
										{STATUS_LABELS[value]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button type="button" onClick={submit} disabled={!canSubmit}>
						<Plus className="size-4" />
						Hinzufügen
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function PlanItemRow({
	item,
	showDepartment,
	onUpdate,
	onDelete,
}: {
	item: FinancePlanItem;
	showDepartment: boolean;
	onUpdate: (input: PlanItemUpdateInput) => void;
	onDelete: (id: string) => void;
}): ReactElement {
	function changeStatus(status: FinancePlanStatus): void {
		onUpdate({
			id: item.id,
			label: item.label,
			category: item.category,
			plannedAmount: item.planned_amount,
			expectedMonth: item.expected_month,
			status,
			note: item.note,
		});
	}

	return (
		<TableRow>
			<TableCell className="font-medium">{item.label}</TableCell>
			{showDepartment ? <TableCell>{item.department}</TableCell> : null}
			<TableCell className="text-muted-foreground">
				{item.category ?? "—"}
			</TableCell>
			<TableCell className="text-right tabular-nums">
				{formatFinanceAmount(item.planned_amount)}
			</TableCell>
			<TableCell className="tabular-nums">
				{item.expected_month ?? "—"}
			</TableCell>
			<TableCell>
				<Select
					value={item.status}
					onValueChange={(value) => changeStatus(value as FinancePlanStatus)}
				>
					<SelectTrigger aria-label={`Status für ${item.label}`}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STATUS_ORDER.map((value) => (
							<SelectItem key={value} value={value}>
								{STATUS_LABELS[value]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={`Planposten ${item.label} löschen`}
					onClick={() => onDelete(item.id)}
				>
					<Trash2 className="size-4 text-destructive" />
				</Button>
			</TableCell>
		</TableRow>
	);
}
