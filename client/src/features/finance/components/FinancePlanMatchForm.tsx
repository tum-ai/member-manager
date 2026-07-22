import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinancePlanItem,
	type FinancePlanItemPostingMatchCreate,
	FinancePlanItemPostingMatchCreateSchema,
} from "@member-manager/shared";
import { Link2, Loader2 } from "lucide-react";
import type { ReactElement } from "react";
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
import { formatFinanceAmount } from "@/features/finance/financeUtils";

interface FinancePlanMatchFormProps {
	postingExternalId: string;
	unmatchedAmount: number;
	planItems: FinancePlanItem[];
	isPending: boolean;
	onSubmit: (input: FinancePlanItemPostingMatchCreate) => Promise<void>;
}

export function FinancePlanMatchForm({
	postingExternalId,
	unmatchedAmount,
	planItems,
	isPending,
	onSubmit,
}: FinancePlanMatchFormProps): ReactElement {
	const form = useForm<FinancePlanItemPostingMatchCreate>({
		resolver: zodResolver(FinancePlanItemPostingMatchCreateSchema),
		defaultValues: {
			plan_item_id: "",
			posting_external_id: postingExternalId,
			matched_amount: unmatchedAmount,
			match_type: "manual",
		},
	});

	async function submit(
		values: FinancePlanItemPostingMatchCreate,
	): Promise<void> {
		const succeeded = await onSubmit(values).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset({
				plan_item_id: "",
				posting_external_id: postingExternalId,
				matched_amount: unmatchedAmount,
				match_type: "manual",
			});
		}
	}

	return (
		<form
			className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(14rem,1fr)_9rem_auto]"
			onSubmit={form.handleSubmit(submit)}
		>
			<Field
				label="Plan item"
				htmlFor={`match-plan-item-${postingExternalId}`}
				error={form.formState.errors.plan_item_id?.message}
			>
				<Controller
					control={form.control}
					name="plan_item_id"
					render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}>
							<SelectTrigger
								id={`match-plan-item-${postingExternalId}`}
								aria-label="Match plan item"
							>
								<SelectValue placeholder="Select plan item" />
							</SelectTrigger>
							<SelectContent>
								{planItems.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{item.label} · {item.department} ·{" "}
										{formatFinanceAmount(item.planned_amount)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</Field>
			<Field
				label="Amount (€)"
				htmlFor={`match-amount-${postingExternalId}`}
				error={form.formState.errors.matched_amount?.message}
			>
				<Input
					id={`match-amount-${postingExternalId}`}
					type="number"
					min={0.01}
					max={unmatchedAmount}
					step="0.01"
					inputMode="decimal"
					className="text-right tabular-nums"
					{...form.register("matched_amount", { valueAsNumber: true })}
				/>
			</Field>
			<Button type="submit" size="sm" disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
				Match
			</Button>
		</form>
	);
}
