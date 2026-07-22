import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinancePostingAllocationInput,
	type FinanceProject,
	type FinanceReallocationRequestCreate,
	FinanceReallocationRequestCreateSchema,
} from "@member-manager/shared";
import { Loader2, Send } from "lucide-react";
import type { ReactElement } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FinanceAllocationRows } from "./FinanceAllocationRows";

interface FinanceReallocationFormProps {
	postingExternalId: string;
	projects: FinanceProject[];
	department: string | null;
	isPending: boolean;
	onSubmit: (input: FinanceReallocationRequestCreate) => Promise<void>;
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

export function FinanceReallocationForm({
	postingExternalId,
	projects,
	department,
	isPending,
	onSubmit,
}: FinanceReallocationFormProps): ReactElement {
	const form = useForm<FinanceReallocationRequestCreate>({
		resolver: zodResolver(FinanceReallocationRequestCreateSchema),
		defaultValues: {
			posting_external_id: postingExternalId,
			requesting_department: department ?? undefined,
			reason: "",
			allocations: [defaultAllocation(department)],
		},
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

	async function submit(
		values: FinanceReallocationRequestCreate,
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
		const succeeded = await onSubmit(values).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset({
				posting_external_id: postingExternalId,
				requesting_department: department ?? undefined,
				reason: "",
				allocations: [defaultAllocation(department)],
			});
		}
	}

	return (
		<form
			className="grid gap-3 rounded-md border bg-muted/20 p-3"
			onSubmit={form.handleSubmit(submit)}
		>
			<div>
				<h4 className="text-sm font-semibold">Request reallocation</h4>
				<p className="text-xs text-muted-foreground">
					Finance reviews and applies the proposed allocation.
				</p>
			</div>
			<Field
				label="Reason"
				htmlFor={`reallocation-reason-${postingExternalId}`}
				required
				error={form.formState.errors.reason?.message}
			>
				<Textarea
					id={`reallocation-reason-${postingExternalId}`}
					rows={2}
					placeholder="Why should this posting be allocated differently?"
					{...form.register("reason")}
				/>
			</Field>
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
				{isPending ? <Loader2 className="animate-spin" /> : <Send />}
				Submit request
			</Button>
		</form>
	);
}
