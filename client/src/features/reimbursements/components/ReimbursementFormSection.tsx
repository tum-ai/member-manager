import type React from "react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { ReimbursementSubmissionType } from "@/features/reimbursements/reimbursementTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { ReceiptUpload } from "./ReceiptUpload";

interface ReimbursementFormSectionProps {
	values: FormValues;
	errors: FormErrors;
	isCreating: boolean;
	isReceiptBusy: boolean;
	isDraggingReceipt: boolean;
	isSubmitDisabled: boolean;
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
	isReceiptBusy,
	isDraggingReceipt,
	isSubmitDisabled,
	showDepartmentWarning,
	onDraggingChange,
	onReceiptDrop,
	onReceiptChange,
	onSubmissionTypeChange,
	onFieldChange,
	onSubmit,
}: ReimbursementFormSectionProps): ReactElement {
	return (
		<GlassCard>
			<div className="p-5 md:p-6">
				<h2 className="mb-4 text-xl font-semibold">New request</h2>

				<form onSubmit={onSubmit} noValidate>
					<ReceiptUpload
						receipt={values.receipt}
						isReceiptBusy={isReceiptBusy}
						isDraggingReceipt={isDraggingReceipt}
						receiptError={errors.receiptFile}
						onDraggingChange={onDraggingChange}
						onDrop={onReceiptDrop}
						onChange={onReceiptChange}
					/>

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
						</ToggleGroup>
					</div>

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

						<div className="flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="reimbursement-iban">IBAN</Label>
							<Input
								id="reimbursement-iban"
								value={values.paymentIban}
								onChange={(event) =>
									onFieldChange("paymentIban", event.target.value)
								}
								aria-invalid={Boolean(errors.paymentIban)}
								required
							/>
							{errors.paymentIban && (
								<p className="text-xs text-destructive">{errors.paymentIban}</p>
							)}
						</div>
						<div className="flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="reimbursement-bic">BIC</Label>
							<Input
								id="reimbursement-bic"
								value={values.paymentBic}
								onChange={(event) =>
									onFieldChange("paymentBic", event.target.value)
								}
								aria-invalid={Boolean(errors.paymentBic)}
								required
							/>
							{errors.paymentBic && (
								<p className="text-xs text-destructive">{errors.paymentBic}</p>
							)}
						</div>
					</div>

					<div className="mt-6 flex justify-end">
						<Button type="submit" disabled={isSubmitDisabled}>
							{isCreating ? "Submitting..." : "Submit request"}
						</Button>
					</div>
				</form>
			</div>
		</GlassCard>
	);
}
