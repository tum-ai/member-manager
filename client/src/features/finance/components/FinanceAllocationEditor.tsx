import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinancePostingAllocationInput,
	type FinancePostingAllocationReplace,
	FinancePostingAllocationReplaceSchema,
	type FinanceProject,
} from "@member-manager/shared";
import { Loader2, Save, Split, Target } from "lucide-react";
import { type ReactElement, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
	PostingAllocationInput,
	ProjectAllocationInput,
} from "@/features/finance/hooks/useFinanceManagement";
import { FinanceAllocationRows } from "./FinanceAllocationRows";

interface FinanceAllocationEditorProps {
	postingExternalId: string;
	projects: FinanceProject[];
	department: string | null;
	isPending: boolean;
	onAllocateToProject: (input: ProjectAllocationInput) => Promise<void>;
	onSplitAllocation: (input: PostingAllocationInput) => Promise<void>;
}

function defaultAllocation(
	department: string | null,
): FinancePostingAllocationInput {
	return {
		department,
		project_id: null,
		tax_area: null,
		percentage: 100,
		note: null,
	};
}

export function FinanceAllocationEditor({
	postingExternalId,
	projects,
	department,
	isPending,
	onAllocateToProject,
	onSplitAllocation,
}: FinanceAllocationEditorProps): ReactElement {
	const [mode, setMode] = useState<"project" | "split">("project");
	const [projectId, setProjectId] = useState("");
	const form = useForm<FinancePostingAllocationReplace>({
		resolver: zodResolver(FinancePostingAllocationReplaceSchema),
		defaultValues: { allocations: [defaultAllocation(department)] },
	});
	const rows = useFieldArray({ control: form.control, name: "allocations" });
	const allocations = form.watch("allocations");

	function updateAllocation(
		index: number,
		patch: Partial<FinancePostingAllocationInput>,
	): void {
		rows.update(index, { ...allocations[index], ...patch });
	}

	function addAllocation(): void {
		const nextCount = rows.fields.length + 1;
		const equalShare = Math.floor((100 / nextCount) * 100) / 100;
		const current = form.getValues("allocations");
		current.forEach((allocation, index) => {
			rows.update(index, { ...allocation, percentage: equalShare });
		});
		rows.append({
			...defaultAllocation(department),
			percentage: Math.round((100 - equalShare * current.length) * 100) / 100,
		});
	}

	async function assignProject(): Promise<void> {
		if (!projectId) {
			return;
		}
		const succeeded = await onAllocateToProject({
			postingExternalId,
			projectId,
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			setProjectId("");
		}
	}

	async function submitSplit(
		values: FinancePostingAllocationReplace,
	): Promise<void> {
		const total = values.allocations.reduce(
			(sum, allocation) => sum + (allocation.percentage ?? 0),
			0,
		);
		if (Math.abs(total - 100) > 0.01) {
			form.setError("root", {
				message: "The percentage allocation must total exactly 100%.",
			});
			return;
		}
		const succeeded = await onSplitAllocation({
			postingExternalId,
			allocations: values.allocations,
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset({ allocations: [defaultAllocation(department)] });
		}
	}

	return (
		<div className="grid gap-3 rounded-md border border-brand/20 bg-brand/5 p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h4 className="text-sm font-semibold">Allocate posting</h4>
					<p className="text-xs text-muted-foreground">
						Direct allocation by a Finance reviewer.
					</p>
				</div>
				<ToggleGroup
					type="single"
					value={mode}
					variant="outline"
					size="sm"
					onValueChange={(value) => {
						if (value === "project" || value === "split") {
							setMode(value);
						}
					}}
					aria-label="Allocation mode"
				>
					<ToggleGroupItem value="project" aria-label="100% project">
						<Target />
						100% project
					</ToggleGroupItem>
					<ToggleGroupItem value="split" aria-label="Percentage split">
						<Split />
						Split
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{mode === "project" ? (
				<div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto]">
					<Field
						label="Project"
						htmlFor={`allocation-project-${postingExternalId}`}
					>
						<Select value={projectId} onValueChange={setProjectId}>
							<SelectTrigger
								id={`allocation-project-${postingExternalId}`}
								aria-label="Project for full allocation"
							>
								<SelectValue placeholder="Select project" />
							</SelectTrigger>
							<SelectContent>
								{projects
									.filter((project) => project.status !== "cancelled")
									.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name} · {project.department}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</Field>
					<Button
						type="button"
						disabled={!projectId || isPending}
						className="bg-[#9A64D9] text-white hover:bg-[#523573]"
						onClick={() => {
							void assignProject();
						}}
					>
						{isPending ? <Loader2 className="animate-spin" /> : <Target />}
						Allocate fully
					</Button>
				</div>
			) : (
				<form className="grid gap-3" onSubmit={form.handleSubmit(submitSplit)}>
					<FinanceAllocationRows
						rowKeys={rows.fields.map((field) => field.id)}
						allocations={allocations}
						projects={projects}
						department={department}
						getError={(index, field) => {
							const errors = form.formState.errors.allocations;
							return Array.isArray(errors)
								? errors[index]?.[field]?.message
								: undefined;
						}}
						onChange={updateAllocation}
						onAdd={addAllocation}
						onRemove={rows.remove}
					/>
					{form.formState.errors.root?.message ? (
						<p className="text-xs text-destructive">
							{form.formState.errors.root.message}
						</p>
					) : null}
					<Button
						type="submit"
						size="sm"
						disabled={isPending}
						className="w-fit bg-[#9A64D9] text-white hover:bg-[#523573]"
					>
						{isPending ? <Loader2 className="animate-spin" /> : <Save />}
						Save allocation
					</Button>
				</form>
			)}
		</div>
	);
}
