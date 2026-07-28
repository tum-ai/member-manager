import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinanceBudgetTransferRequest,
	type FinanceBudgetTransferRequestCreate,
	FinanceBudgetTransferRequestCreateSchema,
	TUMAI_DEPARTMENTS,
} from "@member-manager/shared";
import { Check, Loader2, Send, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
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
import {
	formatFinanceAmount,
	formatFinanceDate,
} from "@/features/finance/financeUtils";
import type { BudgetTransferReviewInput } from "@/features/finance/hooks/useFinanceManagement";

const STATUS_LABELS = {
	pending: "Pending",
	approved: "Approved",
	rejected: "Rejected",
} as const;

const STATUS_VARIANTS: Record<keyof typeof STATUS_LABELS, BadgeVariant> = {
	pending: "warning",
	approved: "success",
	rejected: "danger",
};

interface FinanceBudgetTransferSectionProps {
	period: FinancePeriod;
	requests: FinanceBudgetTransferRequest[];
	department: string | null;
	canManage: boolean;
	isSubmitting: boolean;
	reviewingRequestId: string | null;
	onCreate: (input: FinanceBudgetTransferRequestCreate) => Promise<void>;
	onReview: (input: BudgetTransferReviewInput) => Promise<void>;
}

export function FinanceBudgetTransferSection({
	period,
	requests,
	department,
	canManage,
	isSubmitting,
	reviewingRequestId,
	onCreate,
	onReview,
}: FinanceBudgetTransferSectionProps): ReactElement {
	return (
		<section
			aria-labelledby="budget-transfer-heading"
			className="overflow-hidden rounded-md border bg-card shadow-sm"
		>
			<div className="border-b px-4 py-3">
				<h3 id="budget-transfer-heading" className="text-sm font-semibold">
					Budget transfers
				</h3>
				<p className="text-xs text-muted-foreground">
					Move budget between departments; Finance approves each change.
				</p>
			</div>
			<BudgetTransferForm
				period={period}
				department={department}
				canManage={canManage}
				isSubmitting={isSubmitting}
				onCreate={onCreate}
			/>
			<div className="divide-y border-t">
				{requests.length === 0 ? (
					<p className="p-4 text-sm text-muted-foreground">
						No budget transfers available.
					</p>
				) : (
					requests.map((request) => (
						<BudgetTransferRow
							key={request.id}
							request={request}
							canManage={canManage}
							isReviewing={reviewingRequestId === request.id}
							onReview={onReview}
						/>
					))
				)}
			</div>
		</section>
	);
}

function BudgetTransferForm({
	period,
	department,
	canManage,
	isSubmitting,
	onCreate,
}: {
	period: FinancePeriod;
	department: string | null;
	canManage: boolean;
	isSubmitting: boolean;
	onCreate: (input: FinanceBudgetTransferRequestCreate) => Promise<void>;
}): ReactElement {
	const form = useForm<FinanceBudgetTransferRequestCreate>({
		resolver: zodResolver(FinanceBudgetTransferRequestCreateSchema),
		mode: "onChange",
		defaultValues: {
			source_department: department ?? "",
			target_department: "",
			period_type: period.type,
			period_key: period.key,
			reason: "",
		},
	});
	const sourceDepartment = form.watch("source_department") ?? "";

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
			!canManage &&
			form.getValues("source_department") !== (department ?? "")
		) {
			form.setValue("source_department", department ?? "", {
				shouldValidate: true,
			});
		}
	}, [canManage, department, form]);

	async function submit(
		values: FinanceBudgetTransferRequestCreate,
	): Promise<void> {
		const succeeded = await onCreate(values).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset({
				source_department: canManage ? "" : (department ?? ""),
				target_department: "",
				period_type: period.type,
				period_key: period.key,
				reason: "",
			});
			form.setValue("amount", Number.NaN);
		}
	}

	return (
		<form
			className="grid gap-3 p-4 lg:grid-cols-[12rem_12rem_9rem_minmax(14rem,1fr)_auto] lg:items-end"
			onSubmit={form.handleSubmit(submit)}
		>
			<Field
				label="From department"
				htmlFor="budget-transfer-source"
				error={form.formState.errors.source_department?.message}
			>
				{canManage ? (
					<Controller
						control={form.control}
						name="source_department"
						render={({ field }) => (
							<Select value={field.value ?? ""} onValueChange={field.onChange}>
								<SelectTrigger
									id="budget-transfer-source"
									aria-label="Budget source"
									aria-invalid={
										form.formState.errors.source_department ? "true" : undefined
									}
									aria-describedby={
										form.formState.errors.source_department
											? "budget-transfer-source-error"
											: undefined
									}
								>
									<SelectValue placeholder="Select" />
								</SelectTrigger>
								<SelectContent>
									{TUMAI_DEPARTMENTS.map((option) => (
										<SelectItem key={option} value={option}>
											{option}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				) : (
					<Input
						id="budget-transfer-source"
						value={department ?? ""}
						disabled
					/>
				)}
			</Field>
			<Field
				label="To department"
				htmlFor="budget-transfer-target"
				error={form.formState.errors.target_department?.message}
			>
				<Controller
					control={form.control}
					name="target_department"
					render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}>
							<SelectTrigger
								id="budget-transfer-target"
								aria-label="Budget destination"
								aria-invalid={
									form.formState.errors.target_department ? "true" : undefined
								}
								aria-describedby={
									form.formState.errors.target_department
										? "budget-transfer-target-error"
										: undefined
								}
							>
								<SelectValue placeholder="Select" />
							</SelectTrigger>
							<SelectContent>
								{TUMAI_DEPARTMENTS.filter(
									(option) => option !== sourceDepartment,
								).map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</Field>
			<Field
				label="Amount (€)"
				htmlFor="budget-transfer-amount"
				error={form.formState.errors.amount?.message}
			>
				<Input
					id="budget-transfer-amount"
					type="number"
					min={0.01}
					step="0.01"
					aria-invalid={form.formState.errors.amount ? "true" : undefined}
					aria-describedby={
						form.formState.errors.amount
							? "budget-transfer-amount-error"
							: undefined
					}
					{...form.register("amount", { valueAsNumber: true })}
				/>
			</Field>
			<Field
				label="Reason"
				htmlFor="budget-transfer-reason"
				error={form.formState.errors.reason?.message}
			>
				<Textarea
					id="budget-transfer-reason"
					rows={1}
					aria-invalid={form.formState.errors.reason ? "true" : undefined}
					aria-describedby={
						form.formState.errors.reason
							? "budget-transfer-reason-error"
							: undefined
					}
					{...form.register("reason")}
				/>
			</Field>
			<Button
				type="submit"
				size="sm"
				disabled={isSubmitting || !form.formState.isValid}
			>
				{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
				Request
			</Button>
		</form>
	);
}

function BudgetTransferRow({
	request,
	canManage,
	isReviewing,
	onReview,
}: {
	request: FinanceBudgetTransferRequest;
	canManage: boolean;
	isReviewing: boolean;
	onReview: (input: BudgetTransferReviewInput) => Promise<void>;
}): ReactElement {
	const [reviewNote, setReviewNote] = useState("");

	function review(decision: "approved" | "rejected"): void {
		void onReview({
			requestId: request.id,
			review: {
				decision,
				review_note: reviewNote.trim() || null,
			},
		});
	}

	return (
		<div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)]">
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium">
						{request.source_department} → {request.target_department}
					</span>
					<Badge variant={STATUS_VARIANTS[request.status]}>
						{STATUS_LABELS[request.status]}
					</Badge>
					<span className="text-xs text-muted-foreground">
						{formatFinanceDate(request.created_at)}
					</span>
				</div>
				<p className="mt-1 text-sm">
					{formatFinanceAmount(request.amount)} · {request.reason}
				</p>
				<p className="text-xs text-muted-foreground">{request.period_key}</p>
			</div>
			{canManage && request.status === "pending" ? (
				<div className="grid gap-2">
					<Input
						value={reviewNote}
						onChange={(event) => setReviewNote(event.target.value)}
						placeholder="Review note (optional)"
						aria-label={`Review note for budget transfer from ${request.source_department}`}
					/>
					<div className="flex gap-2">
						<Button
							type="button"
							size="sm"
							disabled={isReviewing}
							onClick={() => review("approved")}
						>
							{isReviewing ? <Loader2 className="animate-spin" /> : <Check />}
							Approve
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={isReviewing}
							onClick={() => review("rejected")}
						>
							<X />
							Reject
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
