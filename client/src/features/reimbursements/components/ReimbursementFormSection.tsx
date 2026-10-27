import type React from "react";
import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { IbanInput } from "@/components/IbanInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
	FormErrors,
	FormValues,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import type {
	ReimbursementRequest,
	ReimbursementSubmissionType,
} from "@/features/reimbursements/reimbursementTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { ReceiptUpload } from "./ReceiptUpload";

interface ReimbursementFormSectionProps {
	values: FormValues;
	errors: FormErrors;
	isCreating: boolean;
	isResubmitting: boolean;
	/** The rejected request being corrected; null for a new request. */
	editingRequest: ReimbursementRequest | null;
	onCancelEdit: () => void;
	isReceiptBusy: boolean;
	isDraggingReceipt: boolean;
	isSubmitDisabled: boolean;
	canSubmitVivid: boolean;
	showDepartmentWarning: boolean;
	onDraggingChange: (dragging: boolean) => void;
	onReceiptDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
	onReceiptChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onSubmissionTypeChange: (nextType: ReimbursementSubmissionType | "") => void;
	onFieldChange: <Key extends keyof FormValues>(
		field: Key,
		value: FormValues[Key],
	) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function ReimbursementFormSection({
	values,
	errors,
	isCreating,
	isResubmitting,
	editingRequest,
	onCancelEdit,
	isReceiptBusy,
	isDraggingReceipt,
	isSubmitDisabled,
	canSubmitVivid,
	showDepartmentWarning,
	onDraggingChange,
	onReceiptDrop,
	onReceiptChange,
	onSubmissionTypeChange,
	onFieldChange,
	onSubmit,
}: ReimbursementFormSectionProps): ReactElement {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const editingRequestId = editingRequest?.id ?? null;

	// Starting an edit happens from the request list, which sits above the form
	// on narrow screens. Bring the form into view and move focus to it so
	// keyboard and screen-reader users land where the edit continues.
	useEffect(() => {
		if (!editingRequestId) return;
		headingRef.current?.scrollIntoView?.({
			behavior: "smooth",
			block: "start",
		});
		headingRef.current?.focus({ preventScroll: true });
	}, [editingRequestId]);

	return (
		<GlassCard>
			<div className="p-5 md:p-6">
				<h2
					ref={headingRef}
					tabIndex={-1}
					className="mb-4 text-xl font-semibold outline-none"
				>
					{editingRequest ? "Edit rejected request" : "New request"}
				</h2>

				{editingRequest && (
					<Alert variant="destructive" className="mb-4">
						<AlertTitle>Why it was rejected</AlertTitle>
						<AlertDescription className="break-words whitespace-pre-wrap">
							{editingRequest.rejection_reason || "No reason was given."}
						</AlertDescription>
					</Alert>
				)}

				<form onSubmit={onSubmit} noValidate>
					{/* Type first: the receipt parse fills bank details into the
					    invoice slot, so choosing Invoice before uploading shows the
					    extracted payee IBAN right away. */}
					<div className="mb-4">
						<ToggleGroup
							type="single"
							value={values.submissionType}
							onValueChange={(value) =>
								onSubmissionTypeChange(
									value as ReimbursementSubmissionType | "",
								)
							}
							variant="outline"
							aria-label="Submission type"
							className="w-full"
						>
							<ToggleGroupItem value="reimbursement" className="flex-1">
								Reimbursement
							</ToggleGroupItem>
							<ToggleGroupItem value="invoice" className="flex-1">
								Invoice
							</ToggleGroupItem>
							{canSubmitVivid && (
								<ToggleGroupItem value="vivid_reimbursement" className="flex-1">
									Vivid
								</ToggleGroupItem>
							)}
						</ToggleGroup>
					</div>

					<ReceiptUpload
						receipt={values.receipt}
						isReceiptBusy={isReceiptBusy}
						isDraggingReceipt={isDraggingReceipt}
						receiptError={errors.receiptFile}
						onDraggingChange={onDraggingChange}
						onDrop={onReceiptDrop}
						onChange={onReceiptChange}
					/>

					{values.submissionType === "vivid_reimbursement" && (
						<Alert className="mb-4">
							<AlertDescription>
								Vivid expenses are tracked for virtual card spend. No payment
								details are required.
							</AlertDescription>
						</Alert>
					)}

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="reimbursement-amount">Amount</Label>
							<Input
								id="reimbursement-amount"
								type="number"
								value={values.amount}
								onChange={(event) =>
									onFieldChange("amount", event.target.value)
								}
								aria-invalid={Boolean(errors.amount)}
								min="0"
								step="0.01"
								required
							/>
							{errors.amount && (
								<p className="text-xs text-destructive">{errors.amount}</p>
							)}
						</div>
						<div className="flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="reimbursement-date">Date</Label>
							<Input
								id="reimbursement-date"
								type="date"
								value={values.date}
								onChange={(event) => onFieldChange("date", event.target.value)}
								aria-invalid={Boolean(errors.date)}
								required
							/>
							{errors.date && (
								<p className="text-xs text-destructive">{errors.date}</p>
							)}
						</div>
						<div className="col-span-full flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="reimbursement-department">Department</Label>
							<Select
								value={values.department || undefined}
								onValueChange={(value) => onFieldChange("department", value)}
							>
								<SelectTrigger
									id="reimbursement-department"
									className="w-full"
									aria-label="Department"
									aria-invalid={Boolean(errors.department)}
								>
									<SelectValue placeholder="Department" />
								</SelectTrigger>
								<SelectContent>
									{DEPARTMENTS.map((department) => (
										<SelectItem key={department} value={department}>
											{department}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.department && (
								<p className="text-xs text-destructive">{errors.department}</p>
							)}
						</div>
						{showDepartmentWarning && (
							<Alert className="col-span-full">
								<AlertDescription>
									This request is for a department different from your member
									department. Finance may ask for additional confirmation.
								</AlertDescription>
							</Alert>
						)}
						<div className="col-span-full flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="reimbursement-description">Description</Label>
							<Textarea
								id="reimbursement-description"
								value={values.description}
								onChange={(event) =>
									onFieldChange("description", event.target.value)
								}
								aria-invalid={Boolean(errors.description)}
								rows={3}
								required
							/>
							{errors.description && (
								<p className="text-xs text-destructive">{errors.description}</p>
							)}
						</div>

						{values.submissionType !== "vivid_reimbursement" && (
							<>
								<div className="flex min-w-0 flex-col gap-1.5">
									<Label htmlFor="reimbursement-iban">IBAN</Label>
									<IbanInput
										id="reimbursement-iban"
										value={values.paymentIban}
										onValueChange={(value) =>
											onFieldChange("paymentIban", value)
										}
										error={errors.paymentIban}
										required
									/>
								</div>
								<div className="flex min-w-0 flex-col gap-1.5">
									<Label htmlFor="reimbursement-bic">BIC</Label>
									<Input
										id="reimbursement-bic"
										value={values.paymentBic}
										onChange={(event) =>
											onFieldChange("paymentBic", event.target.value)
										}
										autoCapitalize="characters"
										autoComplete="off"
										autoCorrect="off"
										spellCheck={false}
										aria-invalid={Boolean(errors.paymentBic)}
										required
									/>
									{errors.paymentBic && (
										<p className="text-xs text-destructive">
											{errors.paymentBic}
										</p>
									)}
								</div>
							</>
						)}
					</div>

					<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						{editingRequest && (
							<Button
								type="button"
								variant="outline"
								onClick={onCancelEdit}
								disabled={isResubmitting}
							>
								Cancel
							</Button>
						)}
						<Button type="submit" disabled={isSubmitDisabled}>
							{editingRequest
								? isResubmitting
									? "Resubmitting..."
									: "Resubmit request"
								: isCreating
									? "Submitting..."
									: "Submit request"}
						</Button>
					</div>
				</form>
			</div>
		</GlassCard>
	);
}
