import {
	type FinancePostingAllocationInput,
	type FinanceProject,
	type FinanceTaxArea,
	TUMAI_DEPARTMENTS,
} from "@member-manager/shared";
import { Plus, Trash2 } from "lucide-react";
import { type ReactElement, useMemo } from "react";
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
import { FINANCE_BEREICH_OPTIONS } from "@/features/finance/financeUtils";

const NO_VALUE = "none";

interface FinanceAllocationRowsProps {
	rowKeys: string[];
	allocations: FinancePostingAllocationInput[];
	projects: FinanceProject[];
	department: string | null;
	getError?: (
		index: number,
		field: "department" | "percentage",
	) => string | undefined;
	onChange: (
		index: number,
		patch: Partial<FinancePostingAllocationInput>,
	) => void;
	onAdd: () => void;
	onRemove: (index: number) => void;
}

export function FinanceAllocationRows({
	rowKeys,
	allocations,
	projects,
	department,
	getError,
	onChange,
	onAdd,
	onRemove,
}: FinanceAllocationRowsProps): ReactElement {
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

	return (
		<div className="grid gap-2">
			{allocations.map((allocation, index) => (
				<div
					key={rowKeys[index]}
					className="grid grid-cols-1 items-end gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.5fr_1.2fr_7rem_auto]"
				>
					<Field
						label="Department"
						htmlFor={`allocation-department-${index}`}
						error={getError?.(index, "department")}
					>
						<Select
							value={allocation.department ?? NO_VALUE}
							onValueChange={(value) =>
								onChange(index, {
									department: value === NO_VALUE ? null : value,
								})
							}
						>
							<SelectTrigger
								id={`allocation-department-${index}`}
								aria-label={`Department für Aufteilung ${index + 1}`}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_VALUE}>Automatisch</SelectItem>
								{departmentOptions.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					<Field label="Projekt" htmlFor={`allocation-project-${index}`}>
						<Select
							value={allocation.project_id ?? NO_VALUE}
							onValueChange={(value) => {
								const project =
									value === NO_VALUE
										? undefined
										: projects.find((item) => item.id === value);
								onChange(index, {
									project_id: project?.id ?? null,
									department:
										project?.department ?? allocation.department ?? null,
									tax_area: project?.tax_area ?? allocation.tax_area ?? null,
								});
							}}
						>
							<SelectTrigger
								id={`allocation-project-${index}`}
								aria-label={`Projekt für Aufteilung ${index + 1}`}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_VALUE}>Kein Projekt</SelectItem>
								{projects
									.filter((project) => project.status !== "cancelled")
									.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</Field>

					<Field label="Steuerbereich" htmlFor={`allocation-tax-area-${index}`}>
						<Select
							value={allocation.tax_area ?? NO_VALUE}
							onValueChange={(value) =>
								onChange(index, {
									tax_area:
										value === NO_VALUE ? null : (value as FinanceTaxArea),
								})
							}
						>
							<SelectTrigger
								id={`allocation-tax-area-${index}`}
								aria-label={`Steuerbereich für Aufteilung ${index + 1}`}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_VALUE}>Automatisch</SelectItem>
								{FINANCE_BEREICH_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					<Field
						label="Anteil (%)"
						htmlFor={`allocation-percentage-${index}`}
						error={getError?.(index, "percentage")}
					>
						<Input
							id={`allocation-percentage-${index}`}
							type="number"
							min={0.01}
							max={100}
							step="0.01"
							inputMode="decimal"
							className="text-right tabular-nums"
							value={allocation.percentage ?? ""}
							onChange={(event) =>
								onChange(index, {
									percentage:
										event.target.value === ""
											? undefined
											: Number(event.target.value),
									amount: undefined,
								})
							}
						/>
					</Field>

					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={allocations.length === 1}
						aria-label={`Aufteilung ${index + 1} entfernen`}
						onClick={() => onRemove(index)}
					>
						<Trash2 />
					</Button>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="w-fit"
				onClick={onAdd}
			>
				<Plus />
				Aufteilung hinzufügen
			</Button>
		</div>
	);
}
