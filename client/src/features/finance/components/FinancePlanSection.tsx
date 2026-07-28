import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinancePlanItemCreate,
	FinancePlanItemCreateSchema,
	type FinancePlanItemUpdate,
	FinancePlanItemUpdateSchema,
	TUMAI_DEPARTMENTS,
} from "@member-manager/shared";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { type ReactElement, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
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
	FinancePlanDirection,
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
	planned: "Planned",
	committed: "Committed",
	spent: "Spent",
};
const STATUS_ORDER: FinancePlanStatus[] = ["planned", "committed", "spent"];
const DIRECTION_LABELS: Record<FinancePlanDirection, string> = {
	expense: "Expense",
	income: "Income",
};
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
						The plan ({formatFinanceAmount(totals?.planned ?? 0)}) exceeds the
						budget ({formatFinanceAmount(totals?.budget ?? 0)}).
					</AlertDescription>
				</Alert>
			) : null}

			<TotalsRow totals={totals} isLoading={isLoading} />

			<AddPlanItemForm
				period={period}
				canChooseDepartment={canChooseDepartment}
				department={department}
				onCreate={onCreate}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Plan items — {formatFinancePeriodLabel(period)}
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
										<TableHead>Label</TableHead>
										{canChooseDepartment ? (
											<TableHead>Department</TableHead>
										) : null}
										<TableHead>Category</TableHead>
										<TableHead className="text-right">Amount</TableHead>
										<TableHead>Month</TableHead>
										<TableHead className="w-40">Status</TableHead>
										<TableHead className="w-10">
											<span className="sr-only">Actions</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={canChooseDepartment ? 7 : 6}
												className="text-center text-muted-foreground"
											>
												No plan items for this period.
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
				<Label htmlFor="finance-plan-type">Period type</Label>
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
						<SelectItem value="year">Year</SelectItem>
						<SelectItem value="semester">Semester</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-plan-period">Period</Label>
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
		{ label: "Planned expenses", value: totals?.planned_expenses ?? 0 },
		{ label: "Planned income", value: totals?.planned_income ?? 0 },
		{ label: "Planned net", value: totals?.planned_net ?? 0 },
		{ label: "Budget", value: totals?.budget ?? 0 },
		{ label: "Actual", value: totals?.actual ?? 0 },
	];

	return (
		<section
			aria-label="Plan metrics"
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
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
	period,
	canChooseDepartment,
	department,
	onCreate,
}: {
	period: FinancePeriod;
	canChooseDepartment: boolean;
	department: string | null;
	onCreate: (input: PlanItemCreateInput) => void;
}): ReactElement {
	const form = useForm<FinancePlanItemCreate>({
		resolver: zodResolver(FinancePlanItemCreateSchema),
		mode: "onChange",
		defaultValues: {
			department: canChooseDepartment ? "" : (department ?? ""),
			period_type: period.type,
			period_key: period.key,
			label: "",
			category: null,
			direction: "expense",
			expected_month: null,
			status: "planned",
			note: null,
		},
	});

	useEffect(() => {
		if (form.getValues("period_type") !== period.type) {
			form.setValue("period_type", period.type, { shouldValidate: true });
		}
		if (form.getValues("period_key") !== period.key) {
			form.setValue("period_key", period.key, { shouldValidate: true });
		}
	}, [form, period.key, period.type]);

	useEffect(() => {
		if (
			!canChooseDepartment &&
			form.getValues("department") !== (department ?? "")
		) {
			form.setValue("department", department ?? "", {
				shouldValidate: true,
			});
		}
	}, [canChooseDepartment, department, form]);

	function submit(values: FinancePlanItemCreate): void {
		onCreate({
			department: values.department,
			label: values.label,
			category: values.category ?? null,
			direction: values.direction ?? "expense",
			plannedAmount: values.planned_amount,
			expectedMonth: values.expected_month ?? null,
			status: values.status ?? "planned",
			note: values.note ?? null,
		});
		form.reset({
			department: canChooseDepartment ? "" : (department ?? ""),
			period_type: period.type,
			period_key: period.key,
			label: "",
			category: null,
			direction: "expense",
			expected_month: null,
			status: "planned",
			note: null,
		});
		form.setValue("planned_amount", Number.NaN);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Add plan item</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={form.handleSubmit(submit)}
				>
					{canChooseDepartment ? (
						<Field
							label="Department"
							htmlFor="plan-dept"
							error={form.formState.errors.department?.message}
						>
							<Controller
								control={form.control}
								name="department"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger
											id="plan-dept"
											className="w-44"
											aria-invalid={
												form.formState.errors.department ? "true" : undefined
											}
											aria-describedby={
												form.formState.errors.department
													? "plan-dept-error"
													: undefined
											}
										>
											<SelectValue placeholder="Select" />
										</SelectTrigger>
										<SelectContent>
											{DEPARTMENT_OPTIONS.map((option) => (
												<SelectItem key={option} value={option}>
													{option}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</Field>
					) : null}
					<Field
						label="Label"
						htmlFor="plan-label"
						error={form.formState.errors.label?.message}
					>
						<Input
							id="plan-label"
							placeholder="e.g. Venue"
							className="w-44"
							aria-invalid={form.formState.errors.label ? "true" : undefined}
							aria-describedby={
								form.formState.errors.label ? "plan-label-error" : undefined
							}
							{...form.register("label")}
						/>
					</Field>
					<Field
						label="Category"
						htmlFor="plan-category"
						error={form.formState.errors.category?.message}
					>
						<Controller
							control={form.control}
							name="category"
							render={({ field }) => (
								<Input
									id="plan-category"
									value={field.value ?? ""}
									onChange={(event) =>
										field.onChange(event.target.value || null)
									}
									placeholder="optional"
									className="w-36"
									aria-invalid={
										form.formState.errors.category ? "true" : undefined
									}
									aria-describedby={
										form.formState.errors.category
											? "plan-category-error"
											: undefined
									}
								/>
							)}
						/>
					</Field>
					<Field label="Direction" htmlFor="plan-direction">
						<Controller
							control={form.control}
							name="direction"
							render={({ field }) => (
								<Select
									value={field.value ?? "expense"}
									onValueChange={field.onChange}
								>
									<SelectTrigger id="plan-direction" className="w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="expense">Expense</SelectItem>
										<SelectItem value="income">Income</SelectItem>
									</SelectContent>
								</Select>
							)}
						/>
					</Field>
					<Field
						label="Amount (€)"
						htmlFor="plan-amount"
						error={form.formState.errors.planned_amount?.message}
					>
						<Input
							id="plan-amount"
							type="number"
							min={0}
							inputMode="decimal"
							className="w-32 text-right tabular-nums"
							aria-invalid={
								form.formState.errors.planned_amount ? "true" : undefined
							}
							aria-describedby={
								form.formState.errors.planned_amount
									? "plan-amount-error"
									: undefined
							}
							{...form.register("planned_amount", { valueAsNumber: true })}
						/>
					</Field>
					<Field
						label="Month"
						htmlFor="plan-month"
						error={form.formState.errors.expected_month?.message}
					>
						<Controller
							control={form.control}
							name="expected_month"
							render={({ field }) => (
								<Input
									id="plan-month"
									type="month"
									value={field.value ?? ""}
									onChange={(event) =>
										field.onChange(event.target.value || null)
									}
									className="w-40"
									aria-invalid={
										form.formState.errors.expected_month ? "true" : undefined
									}
									aria-describedby={
										form.formState.errors.expected_month
											? "plan-month-error"
											: undefined
									}
								/>
							)}
						/>
					</Field>
					<Field label="Status" htmlFor="plan-status">
						<Controller
							control={form.control}
							name="status"
							render={({ field }) => (
								<Select
									value={field.value ?? "planned"}
									onValueChange={field.onChange}
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
							)}
						/>
					</Field>
					<Button type="submit" disabled={!form.formState.isValid}>
						<Plus className="size-4" />
						Add
					</Button>
				</form>
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
	const form = useForm<FinancePlanItemUpdate>({
		resolver: zodResolver(FinancePlanItemUpdateSchema),
		defaultValues: {
			label: item.label,
			category: item.category,
			direction: item.direction ?? "expense",
			planned_amount: item.planned_amount,
			expected_month: item.expected_month,
			status: item.status,
			note: item.note,
		},
	});

	useEffect(() => {
		const values: FinancePlanItemUpdate = {
			label: item.label,
			category: item.category,
			direction: item.direction ?? "expense",
			planned_amount: item.planned_amount,
			expected_month: item.expected_month,
			status: item.status,
			note: item.note,
		};
		const current = form.getValues();
		if (
			current.label !== values.label ||
			current.category !== values.category ||
			current.direction !== values.direction ||
			current.planned_amount !== values.planned_amount ||
			current.expected_month !== values.expected_month ||
			current.status !== values.status ||
			current.note !== values.note
		) {
			form.reset(values);
		}
	}, [form, item]);

	function submit(values: FinancePlanItemUpdate): void {
		onUpdate({
			id: item.id,
			label: values.label,
			category: values.category ?? null,
			direction: values.direction ?? "expense",
			plannedAmount: values.planned_amount,
			expectedMonth: values.expected_month ?? null,
			status: values.status,
			note: values.note ?? null,
		});
	}

	function changeStatus(status: FinancePlanStatus): void {
		form.setValue("status", status, { shouldValidate: true });
		void form.handleSubmit(submit)();
	}

	return (
		<TableRow>
			<TableCell className="font-medium">{item.label}</TableCell>
			{showDepartment ? <TableCell>{item.department}</TableCell> : null}
			<TableCell className="text-muted-foreground">
				{item.category ?? "—"} · {DIRECTION_LABELS[item.direction ?? "expense"]}
			</TableCell>
			<TableCell className="text-right tabular-nums">
				{formatFinanceAmount(item.planned_amount)}
			</TableCell>
			<TableCell className="tabular-nums">
				{item.expected_month ?? "—"}
			</TableCell>
			<TableCell>
				<Select value={form.watch("status")} onValueChange={changeStatus}>
					<SelectTrigger
						aria-label={`Status for ${item.label}`}
						aria-invalid={form.formState.errors.status ? "true" : undefined}
					>
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
					aria-label={`Delete plan item ${item.label}`}
					onClick={() => onDelete(item.id)}
				>
					<Trash2 className="size-4 text-destructive" />
				</Button>
			</TableCell>
		</TableRow>
	);
}
