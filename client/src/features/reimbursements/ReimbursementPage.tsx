import type { User } from "@supabase/supabase-js";
import { FileCheck2, UploadCloud } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useMemberData } from "../../hooks/useMemberData";
import {
	type CreateReimbursementRequestPayload,
	type ReimbursementRequest,
	type ReimbursementSubmissionType,
	useReimbursementRequests,
} from "../../hooks/useReimbursementRequests";
import { useSepaData } from "../../hooks/useSepaData";
import { DEPARTMENTS } from "../../lib/constants";
import ToolPageShell from "../tools/ToolPageShell";

interface ReimbursementPageProps {
	user: User;
}

interface ReceiptState {
	fileName: string;
	mimeType: string;
	base64: string;
}

interface FormValues {
	submissionType: ReimbursementSubmissionType;
	amount: string;
	date: string;
	description: string;
	department: string;
	paymentIban: string;
	paymentBic: string;
	receipt: ReceiptState | null;
}

type FormErrors = Partial<Record<keyof FormValues | "receiptFile", string>>;

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set([
	"application/pdf",
	"image/jpeg",
	"image/jpg",
	"image/png",
]);

const defaultValues: FormValues = {
	submissionType: "reimbursement",
	amount: "",
	date: "",
	description: "",
	department: "",
	paymentIban: "",
	paymentBic: "",
	receipt: null,
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

function formatDate(value: string): string {
	return value
		? new Intl.DateTimeFormat("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			}).format(new Date(`${value}T00:00:00`))
		: "No date";
}

function formatAmount(value: number): string {
	return new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: "EUR",
	}).format(Number(value));
}

function getStatusLabel(request: ReimbursementRequest): string {
	if (request.approval_status === "not_approved") return "Not approved";
	if (request.status === "paid" || request.payment_status === "paid")
		return "Paid";
	if (request.approval_status === "approved") return "Approved";
	return "Pending";
}

function getRequestTypeLabel(request: ReimbursementRequest): string {
	return request.submission_type === "invoice" ? "Invoice" : "Reimbursement";
}

function sortRequestsByDateDesc(
	requests: ReimbursementRequest[],
): ReimbursementRequest[] {
	return [...requests].sort((left, right) => {
		const rightTime = new Date(right.created_at ?? right.date ?? "").getTime();
		const leftTime = new Date(left.created_at ?? left.date ?? "").getTime();
		const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
		const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;

		return safeRightTime - safeLeftTime;
	});
}

function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result ?? "");
			resolve(result.includes(",") ? result.split(",")[1] : result);
		};
		reader.onerror = () => reject(new Error("Could not read receipt file"));
		reader.readAsDataURL(file);
	});
}

function validateForm(values: FormValues): FormErrors {
	const errors: FormErrors = {};
	const amount = Number(values.amount);

	if (!values.amount || Number.isNaN(amount) || amount <= 0)
		errors.amount = "Enter a positive amount.";
	if (!values.date) errors.date = "Select the expense date.";
	if (!values.description.trim())
		errors.description = "Describe what this request is for.";
	if (!values.department) errors.department = "Select a department.";
	if (!values.receipt) errors.receiptFile = "Attach a receipt.";
	if (!values.paymentIban.trim()) errors.paymentIban = "IBAN is required.";
	if (!values.paymentBic.trim()) errors.paymentBic = "BIC is required.";

	return errors;
}

export default function ReimbursementPage({
	user,
}: ReimbursementPageProps): React.ReactElement {
	const { showToast } = useToast();
	const {
		requests,
		isLoading,
		error,
		createRequestAsync,
		isCreating,
		parseReceiptAsync,
		isParsingReceipt,
	} = useReimbursementRequests(user.id);
	const { member } = useMemberData(user.id);
	const { sepa } = useSepaData(user.id);
	const [values, setValues] = useState<FormValues>(defaultValues);
	const [errors, setErrors] = useState<FormErrors>({});
	const [isReadingReceipt, setIsReadingReceipt] = useState(false);
	const [isDraggingReceipt, setIsDraggingReceipt] = useState(false);
	const memberDepartment =
		typeof (member as { department?: unknown } | undefined)?.department ===
		"string"
			? ((member as { department: string }).department ?? "")
			: "";
	const profileIban = typeof sepa?.iban === "string" ? sepa.iban : "";
	const profileBic = typeof sepa?.bic === "string" ? sepa.bic : "";

	useEffect(() => {
		if (!memberDepartment && !profileIban && !profileBic) {
			return;
		}

		setValues((current) => ({
			...current,
			department: current.department || memberDepartment,
			paymentIban:
				current.submissionType === "reimbursement"
					? current.paymentIban || profileIban
					: current.paymentIban,
			paymentBic:
				current.submissionType === "reimbursement"
					? current.paymentBic || profileBic
					: current.paymentBic,
		}));
	}, [memberDepartment, profileIban, profileBic]);

	const setField = <Key extends keyof FormValues>(
		field: Key,
		value: FormValues[Key],
	): void => {
		setValues((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
	};

	const handleSubmissionTypeChange = (
		nextType: ReimbursementSubmissionType | "",
	): void => {
		if (!nextType) {
			return;
		}

		setValues((current) => ({
			...current,
			submissionType: nextType,
			paymentIban:
				nextType === "invoice" && current.paymentIban === profileIban
					? ""
					: nextType === "reimbursement"
						? current.paymentIban || profileIban
						: current.paymentIban,
			paymentBic:
				nextType === "invoice" && current.paymentBic === profileBic
					? ""
					: nextType === "reimbursement"
						? current.paymentBic || profileBic
						: current.paymentBic,
		}));
		setErrors((current) => ({
			...current,
			submissionType: undefined,
			paymentIban: undefined,
			paymentBic: undefined,
		}));
	};

	const processReceiptFile = async (file: File): Promise<void> => {
		if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
			setErrors((current) => ({
				...current,
				receiptFile: "Upload a PDF, JPG, or PNG receipt.",
			}));
			return;
		}

		if (file.size > MAX_RECEIPT_BYTES) {
			setErrors((current) => ({
				...current,
				receiptFile: "Receipt must be 10 MB or smaller.",
			}));
			return;
		}

		setIsReadingReceipt(true);
		try {
			const base64 = await readFileAsBase64(file);
			const nextReceipt = {
				fileName: file.name,
				mimeType: file.type,
				base64,
			};
			setField("receipt", nextReceipt);
			setErrors((current) => ({ ...current, receiptFile: undefined }));

			try {
				const parsedReceipt = await parseReceiptAsync({
					receipt_filename: nextReceipt.fileName,
					receipt_mime_type: nextReceipt.mimeType,
					receipt_base64: nextReceipt.base64,
				});

				setValues((current) => ({
					...current,
					amount:
						parsedReceipt.amount !== null && parsedReceipt.amount !== undefined
							? String(parsedReceipt.amount)
							: current.amount,
					date: parsedReceipt.date ?? current.date,
					description: parsedReceipt.description ?? current.description,
					paymentIban: parsedReceipt.payment_iban ?? current.paymentIban,
					paymentBic: parsedReceipt.payment_bic ?? current.paymentBic,
				}));
				showToast(
					"Receipt details extracted. Please review and correct them.",
					"success",
				);
			} catch (parseError) {
				showToast(
					`Receipt attached, but automatic extraction failed: ${getErrorMessage(
						parseError,
					)} Fill the fields manually.`,
					"warning",
				);
			}
		} catch (readError) {
			setErrors((current) => ({
				...current,
				receiptFile: getErrorMessage(readError),
			}));
		} finally {
			setIsReadingReceipt(false);
		}
	};

	const handleReceiptChange = (
		event: React.ChangeEvent<HTMLInputElement>,
	): void => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (file) void processReceiptFile(file);
	};

	const handleReceiptDrop = (
		event: React.DragEvent<HTMLLabelElement>,
	): void => {
		event.preventDefault();
		setIsDraggingReceipt(false);
		if (isReceiptBusy) return;
		const file = event.dataTransfer.files?.[0];
		if (file) void processReceiptFile(file);
	};

	const handleSubmit = async (
		event: React.FormEvent<HTMLFormElement>,
	): Promise<void> => {
		event.preventDefault();

		const nextErrors = validateForm(values);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			return;
		}

		const payload: CreateReimbursementRequestPayload = {
			amount: Number(values.amount),
			date: values.date,
			description: values.description.trim(),
			department: values.department,
			submission_type: values.submissionType,
			payment_iban: values.paymentIban.trim(),
			payment_bic: values.paymentBic.trim(),
			receipt_filename: values.receipt?.fileName ?? "",
			receipt_mime_type: values.receipt?.mimeType ?? "",
			receipt_base64: values.receipt?.base64 ?? "",
		};

		try {
			await createRequestAsync(payload);
			showToast("Reimbursement request submitted.", "success");
			setValues({
				...defaultValues,
				department: memberDepartment,
				paymentIban: profileIban,
				paymentBic: profileBic,
			});
			setErrors({});
		} catch (submitError) {
			showToast(
				`Error submitting reimbursement request: ${getErrorMessage(submitError)}`,
				"error",
			);
		}
	};

	const isReceiptBusy = isReadingReceipt || isParsingReceipt;
	const isSubmitDisabled = isCreating || isReceiptBusy;
	const showDepartmentWarning =
		Boolean(memberDepartment) &&
		Boolean(values.department) &&
		values.department !== memberDepartment;
	const sortedRequests = sortRequestsByDateDesc(requests);

	return (
		<ToolPageShell
			title="Reimbursements"
			description="Submit reimbursements or vendor invoices to the Legal and Finance department."
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.35fr)]">
				<GlassCard>
					<div className="p-5 md:p-6">
						<h2 className="mb-4 text-xl font-semibold">Existing requests</h2>

						{isLoading && (
							<SkeletonRegion
								label="Loading reimbursement requests"
								className="grid gap-3"
							>
								{Array.from({ length: 3 }).map((_, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
										key={i}
										className="min-w-0 rounded-lg bg-muted/50 p-4"
									>
										<div className="mb-2 flex items-start justify-between gap-3">
											<div className="min-w-0 flex-1 space-y-1.5">
												<Skeleton className="h-5 w-40" />
												<Skeleton className="h-4 w-24" />
											</div>
											<Skeleton className="h-5 w-16" />
										</div>
										<div className="mb-2 flex gap-1.5">
											<Skeleton className="h-5 w-20 rounded-full" />
											<Skeleton className="h-5 w-16 rounded-full" />
										</div>
										<Skeleton className="h-4 w-3/4" />
									</div>
								))}
							</SkeletonRegion>
						)}

						{error && (
							<Alert variant="destructive">
								<AlertDescription>
									Error loading reimbursement requests: {getErrorMessage(error)}
								</AlertDescription>
							</Alert>
						)}

						{!isLoading && !error && sortedRequests.length === 0 && (
							<Alert>
								<AlertDescription>
									No reimbursement requests yet.
								</AlertDescription>
							</Alert>
						)}

						{!isLoading && !error && sortedRequests.length > 0 && (
							<div className="grid gap-3">
								{sortedRequests.map((request) => (
									<div
										key={request.id}
										className="min-w-0 rounded-lg bg-muted/50 p-4"
									>
										<div className="mb-2 flex flex-wrap items-start justify-between gap-3">
											<div className="min-w-0 flex-[1_1_220px]">
												<p className="font-bold break-words">
													{getRequestTypeLabel(request)} request
												</p>
												<p className="text-sm text-muted-foreground">
													{formatDate(request.date)}
												</p>
											</div>
											<p className="font-bold whitespace-nowrap">
												{formatAmount(request.amount)}
											</p>
										</div>
										<div className="mb-2 flex flex-wrap gap-1.5">
											<Badge variant="outline">
												{getRequestTypeLabel(request)}
											</Badge>
											<Badge variant="neutral">{getStatusLabel(request)}</Badge>
										</div>
										<p className="mb-1 text-sm break-words">
											{request.description}
										</p>
										{request.receipt_filename && (
											<p className="text-sm text-muted-foreground">
												{request.receipt_filename}
											</p>
										)}
										{request.rejection_reason && (
											<p className="mt-2 text-sm text-destructive">
												{request.rejection_reason}
											</p>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</GlassCard>

				<GlassCard>
					<div className="p-5 md:p-6">
						<h2 className="mb-4 text-xl font-semibold">New request</h2>

						<form onSubmit={handleSubmit} noValidate>
							<div className="mb-6">
								<label
									onDragOver={(event) => {
										event.preventDefault();
										if (!isReceiptBusy) setIsDraggingReceipt(true);
									}}
									onDragLeave={() => setIsDraggingReceipt(false)}
									onDrop={handleReceiptDrop}
									className={cn(
										"flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors",
										"hover:border-brand/50 hover:bg-accent/40",
										isDraggingReceipt && "border-brand bg-brand/5",
										isReceiptBusy && "pointer-events-none opacity-70",
										errors.receiptFile && "border-destructive/60",
									)}
								>
									<span
										className={cn(
											"flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors",
											(isDraggingReceipt || values.receipt) &&
												"bg-brand/10 text-brand",
										)}
									>
										{values.receipt ? (
											<FileCheck2 className="size-6" />
										) : (
											<UploadCloud className="size-6" />
										)}
									</span>
									<div className="grid gap-1">
										<p className="font-medium">
											{isReceiptBusy
												? "Reading receipt…"
												: values.receipt
													? values.receipt.fileName
													: "Drag & drop your receipt"}
										</p>
										<p className="text-sm text-muted-foreground">
											{values.receipt && !isReceiptBusy ? (
												<span className="text-brand">
													Click or drop to replace
												</span>
											) : (
												"or click to browse · PDF, JPG, or PNG up to 10 MB"
											)}
										</p>
									</div>
									<input
										hidden
										type="file"
										aria-label="Receipt file"
										accept="application/pdf,image/jpeg,image/jpg,image/png"
										onChange={handleReceiptChange}
									/>
								</label>
								{!values.receipt && !isReceiptBusy && (
									<p className="mt-2 text-center text-xs text-muted-foreground">
										Details are extracted automatically when possible.
									</p>
								)}
								{errors.receiptFile && (
									<p className="mt-2 text-center text-xs text-destructive">
										{errors.receiptFile}
									</p>
								)}
							</div>

							<div className="mb-4">
								<ToggleGroup
									type="single"
									value={values.submissionType}
									onValueChange={(value) =>
										handleSubmissionTypeChange(
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
										onChange={(event) => setField("amount", event.target.value)}
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
										onChange={(event) => setField("date", event.target.value)}
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
										onValueChange={(value) => setField("department", value)}
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
										<p className="text-xs text-destructive">
											{errors.department}
										</p>
									)}
								</div>
								{showDepartmentWarning && (
									<Alert className="col-span-full">
										<AlertDescription>
											This request is for a department different from your
											member department. Finance may ask for additional
											confirmation.
										</AlertDescription>
									</Alert>
								)}
								<div className="col-span-full flex min-w-0 flex-col gap-1.5">
									<Label htmlFor="reimbursement-description">Description</Label>
									<Textarea
										id="reimbursement-description"
										value={values.description}
										onChange={(event) =>
											setField("description", event.target.value)
										}
										aria-invalid={Boolean(errors.description)}
										rows={3}
										required
									/>
									{errors.description && (
										<p className="text-xs text-destructive">
											{errors.description}
										</p>
									)}
								</div>

								<div className="flex min-w-0 flex-col gap-1.5">
									<Label htmlFor="reimbursement-iban">IBAN</Label>
									<Input
										id="reimbursement-iban"
										value={values.paymentIban}
										onChange={(event) =>
											setField("paymentIban", event.target.value)
										}
										aria-invalid={Boolean(errors.paymentIban)}
										required
									/>
									{errors.paymentIban && (
										<p className="text-xs text-destructive">
											{errors.paymentIban}
										</p>
									)}
								</div>
								<div className="flex min-w-0 flex-col gap-1.5">
									<Label htmlFor="reimbursement-bic">BIC</Label>
									<Input
										id="reimbursement-bic"
										value={values.paymentBic}
										onChange={(event) =>
											setField("paymentBic", event.target.value)
										}
										aria-invalid={Boolean(errors.paymentBic)}
										required
									/>
									{errors.paymentBic && (
										<p className="text-xs text-destructive">
											{errors.paymentBic}
										</p>
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
			</div>
		</ToolPageShell>
	);
}
