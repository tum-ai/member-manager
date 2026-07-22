import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinanceProject,
	type FinanceProjectCreate,
	FinanceProjectCreateSchema,
	type FinanceProjectStatus,
	type FinanceTaxArea,
	TUMAI_DEPARTMENTS,
} from "@member-manager/shared";
import { Loader2, Plus } from "lucide-react";
import { type ReactElement, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { FINANCE_BEREICH_OPTIONS } from "@/features/finance/financeUtils";

const NO_VALUE = "none";

const STATUS_OPTIONS: ReadonlyArray<{
	value: FinanceProjectStatus;
	label: string;
}> = [
	{ value: "draft", label: "Entwurf" },
	{ value: "active", label: "Aktiv" },
	{ value: "completed", label: "Abgeschlossen" },
	{ value: "cancelled", label: "Storniert" },
];

interface FinanceProjectCreateFormProps {
	period: FinancePeriod;
	projects: FinanceProject[];
	department: string | null;
	canManage: boolean;
	isPending: boolean;
	onCreate: (input: FinanceProjectCreate) => Promise<void>;
}

function defaultValues(
	period: FinancePeriod,
	department: string | null,
): FinanceProjectCreate {
	return {
		parent_project_id: null,
		name: "",
		department: department ?? "",
		period_type: period.type,
		period_key: period.key,
		tax_area: null,
		target_amount: 0,
		status: "draft",
		description: null,
	};
}

export function FinanceProjectCreateForm({
	period,
	projects,
	department,
	canManage,
	isPending,
	onCreate,
}: FinanceProjectCreateFormProps): ReactElement {
	const form = useForm<FinanceProjectCreate>({
		resolver: zodResolver(FinanceProjectCreateSchema),
		defaultValues: defaultValues(period, department),
	});
	const departmentOptions = useMemo(
		() =>
			[
				...new Set([
					...TUMAI_DEPARTMENTS,
					...projects.map((project) => project.department),
					...(department ? [department] : []),
				]),
			].sort(),
		[department, projects],
	);

	useEffect(() => {
		form.setValue("period_type", period.type);
		form.setValue("period_key", period.key);
	}, [form, period.key, period.type]);

	useEffect(() => {
		if (!canManage && department) {
			form.setValue("department", department);
		}
	}, [canManage, department, form]);

	async function submit(values: FinanceProjectCreate): Promise<void> {
		const succeeded = await onCreate({
			...values,
			description: values.description?.trim() || null,
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset(defaultValues(period, department));
		}
	}

	return (
		<form
			className="rounded-md border bg-card p-4 shadow-sm"
			onSubmit={form.handleSubmit(submit)}
		>
			<div className="mb-4">
				<h3 className="text-sm font-semibold">Projekt anlegen</h3>
				<p className="text-xs text-muted-foreground">
					Positive Ziele stehen für Einnahmen, negative für Ausgaben.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
				<Field
					label="Name"
					htmlFor="finance-project-name"
					required
					error={form.formState.errors.name?.message}
					className="xl:col-span-3"
				>
					<Input
						id="finance-project-name"
						{...form.register("name")}
						placeholder="z. B. Makeathon 2026"
					/>
				</Field>

				{canManage ? (
					<Field
						label="Department"
						htmlFor="finance-project-department"
						required
						error={form.formState.errors.department?.message}
						className="xl:col-span-2"
					>
						<Controller
							control={form.control}
							name="department"
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange}>
									<SelectTrigger
										id="finance-project-department"
										aria-label="Projekt-Department"
									>
										<SelectValue placeholder="Wählen" />
									</SelectTrigger>
									<SelectContent>
										{departmentOptions.map((option) => (
											<SelectItem key={option} value={option}>
												{option}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
					</Field>
				) : (
					<Field
						label="Department"
						htmlFor="finance-project-scoped-department"
						className="xl:col-span-2"
						description="Durch deinen Zugriff festgelegt."
					>
						<Input
							id="finance-project-scoped-department"
							value={department ?? ""}
							disabled
						/>
					</Field>
				)}

				<Field
					label="Übergeordnetes Projekt"
					htmlFor="finance-project-parent"
					error={form.formState.errors.parent_project_id?.message}
					className="xl:col-span-2"
				>
					<Controller
						control={form.control}
						name="parent_project_id"
						render={({ field }) => (
							<Select
								value={field.value ?? NO_VALUE}
								onValueChange={(value) => {
									const parent =
										value === NO_VALUE
											? undefined
											: projects.find((project) => project.id === value);
									field.onChange(parent?.id ?? null);
									if (parent) {
										form.setValue("department", parent.department);
										form.setValue("tax_area", parent.tax_area);
									}
								}}
							>
								<SelectTrigger
									id="finance-project-parent"
									aria-label="Übergeordnetes Projekt"
								>
									<SelectValue placeholder="Keines" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_VALUE}>Keines</SelectItem>
									{projects.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				</Field>

				<Field
					label="Steuerbereich"
					htmlFor="finance-project-tax-area"
					className="xl:col-span-2"
				>
					<Controller
						control={form.control}
						name="tax_area"
						render={({ field }) => (
							<Select
								value={field.value ?? NO_VALUE}
								onValueChange={(value) =>
									field.onChange(
										value === NO_VALUE ? null : (value as FinanceTaxArea),
									)
								}
							>
								<SelectTrigger
									id="finance-project-tax-area"
									aria-label="Projekt-Steuerbereich"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_VALUE}>Ohne Bereich</SelectItem>
									{FINANCE_BEREICH_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				</Field>

				<Field
					label="Zielbetrag (€)"
					htmlFor="finance-project-target"
					required
					error={form.formState.errors.target_amount?.message}
					className="xl:col-span-1"
				>
					<Input
						id="finance-project-target"
						type="number"
						step="0.01"
						inputMode="decimal"
						className="text-right tabular-nums"
						{...form.register("target_amount", { valueAsNumber: true })}
					/>
				</Field>

				<Field
					label="Status"
					htmlFor="finance-project-status"
					className="xl:col-span-2"
				>
					<Controller
						control={form.control}
						name="status"
						render={({ field }) => (
							<Select
								value={field.value ?? "draft"}
								onValueChange={(value) =>
									field.onChange(value as FinanceProjectStatus)
								}
							>
								<SelectTrigger
									id="finance-project-status"
									aria-label="Projektstatus"
								>
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
						)}
					/>
				</Field>

				<Field
					label="Beschreibung"
					htmlFor="finance-project-description"
					error={form.formState.errors.description?.message}
					className="md:col-span-2 xl:col-span-10"
				>
					<Textarea
						id="finance-project-description"
						rows={2}
						placeholder="Optionaler interner Kontext"
						{...form.register("description")}
					/>
				</Field>
				<div className="flex items-end xl:col-span-2">
					<Button
						type="submit"
						disabled={isPending}
						className="w-full bg-[#9A64D9] text-white hover:bg-[#523573]"
					>
						{isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Plus className="size-4" />
						)}
						Projekt anlegen
					</Button>
				</div>
			</div>
		</form>
	);
}
