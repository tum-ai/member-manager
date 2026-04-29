import AttachFileIcon from "@mui/icons-material/AttachFile";
import {
	Alert,
	alpha,
	Box,
	Button,
	CardContent,
	CircularProgress,
	MenuItem,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
	useTheme,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import type React from "react";
import { useEffect, useState } from "react";

import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useMemberData } from "../../hooks/useMemberData";
import {
	type CreateReimbursementRequestPayload,
	type ReimbursementRequest,
	type ReimbursementSubmissionType,
	useReimbursementRequests,
} from "../../hooks/useReimbursementRequests";
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

function countWords(value: string): number {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

function getStatusLabel(request: ReimbursementRequest): string {
	if (request.approval_status === "not_approved") return "Not approved";
	if (request.status === "paid" || request.payment_status === "paid")
		return "Paid";
	if (request.approval_status === "approved") return "Approved";
	return "Pending";
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
	else if (countWords(values.description) < 5)
		errors.description = "Description must be at least five words.";
	if (!values.department) errors.department = "Select a department.";
	if (!values.receipt) errors.receiptFile = "Attach a receipt.";
	if (values.submissionType === "reimbursement") {
		if (!values.paymentIban.trim())
			errors.paymentIban = "IBAN is required for reimbursements.";
		if (!values.paymentBic.trim())
			errors.paymentBic = "BIC is required for reimbursements.";
	}

	return errors;
}

export default function ReimbursementPage({
	user,
}: ReimbursementPageProps): React.ReactElement {
	const theme = useTheme();
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
	const [values, setValues] = useState<FormValues>(defaultValues);
	const [errors, setErrors] = useState<FormErrors>({});
	const [isReadingReceipt, setIsReadingReceipt] = useState(false);
	const memberDepartment =
		typeof (member as { department?: unknown } | undefined)?.department ===
		"string"
			? ((member as { department: string }).department ?? "")
			: "";

	useEffect(() => {
		if (!memberDepartment) {
			return;
		}

		setValues((current) =>
			current.department
				? current
				: { ...current, department: memberDepartment },
		);
	}, [memberDepartment]);

	const setField = <Key extends keyof FormValues>(
		field: Key,
		value: FormValues[Key],
	): void => {
		setValues((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
	};

	const handleSubmissionTypeChange = (
		_event: React.MouseEvent<HTMLElement>,
		nextType: ReimbursementSubmissionType | null,
	): void => {
		if (!nextType) {
			return;
		}

		setValues((current) => ({
			...current,
			submissionType: nextType,
			paymentIban: nextType === "invoice" ? "" : current.paymentIban,
			paymentBic: nextType === "invoice" ? "" : current.paymentBic,
		}));
		setErrors((current) => ({
			...current,
			submissionType: undefined,
			paymentIban: undefined,
			paymentBic: undefined,
		}));
	};

	const handleReceiptChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	): Promise<void> => {
		const file = event.target.files?.[0];
		event.target.value = "";

		if (!file) {
			return;
		}

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
			payment_iban:
				values.submissionType === "reimbursement"
					? values.paymentIban.trim()
					: null,
			payment_bic:
				values.submissionType === "reimbursement"
					? values.paymentBic.trim()
					: null,
			receipt_filename: values.receipt?.fileName ?? "",
			receipt_mime_type: values.receipt?.mimeType ?? "",
			receipt_base64: values.receipt?.base64 ?? "",
		};

		try {
			await createRequestAsync(payload);
			showToast("Reimbursement request submitted.", "success");
			setValues({ ...defaultValues, department: memberDepartment });
			setErrors({});
		} catch (submitError) {
			showToast(
				`Error submitting reimbursement request: ${getErrorMessage(submitError)}`,
				"error",
			);
		}
	};

	const isReimbursement = values.submissionType === "reimbursement";
	const isReceiptBusy = isReadingReceipt || isParsingReceipt;
	const isSubmitDisabled = isCreating || isReceiptBusy;
	const showDepartmentWarning =
		Boolean(memberDepartment) &&
		Boolean(values.department) &&
		values.department !== memberDepartment;

	return (
		<ToolPageShell
			title="Reimbursements"
			description="Submit reimbursements or vendor invoices for finance review."
		>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
					gap: 3,
				}}
			>
				<GlassCard>
					<CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
						<Typography variant="h5" sx={{ mb: 2 }}>
							Existing requests
						</Typography>

						{isLoading && (
							<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
								<CircularProgress size={22} />
								<Typography color="text.secondary">
									Loading reimbursement requests...
								</Typography>
							</Box>
						)}

						{error && (
							<Alert severity="error">
								Error loading reimbursement requests: {getErrorMessage(error)}
							</Alert>
						)}

						{!isLoading && !error && requests.length === 0 && (
							<Alert severity="info">No reimbursement requests yet.</Alert>
						)}

						{!isLoading && !error && requests.length > 0 && (
							<Box sx={{ display: "grid", gap: 1.5 }}>
								{requests.map((request) => (
									<Box
										key={request.id}
										sx={{
											p: 2,
											borderRadius: 2,
											bgcolor: alpha(theme.palette.primary.main, 0.06),
										}}
									>
										<Box
											sx={{
												display: "flex",
												justifyContent: "space-between",
												gap: 1.5,
												mb: 1,
											}}
										>
											<Box>
												<Typography variant="subtitle1" fontWeight={700}>
													{request.description}
												</Typography>
												<Typography variant="body2" color="text.secondary">
													{request.department} · {formatDate(request.date)}
												</Typography>
											</Box>
											<Typography variant="subtitle1" fontWeight={700}>
												{formatAmount(request.amount)}
											</Typography>
										</Box>
										<Typography variant="body2" color="text.secondary">
											{request.submission_type === "invoice"
												? "Invoice"
												: "Reimbursement"}{" "}
											· {getStatusLabel(request)}
											{request.receipt_filename
												? ` · ${request.receipt_filename}`
												: ""}
										</Typography>
										{request.rejection_reason && (
											<Typography variant="body2" color="error" sx={{ mt: 1 }}>
												{request.rejection_reason}
											</Typography>
										)}
									</Box>
								))}
							</Box>
						)}
					</CardContent>
				</GlassCard>

				<GlassCard>
					<CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
						<Typography variant="h5" sx={{ mb: 2 }}>
							New request
						</Typography>

						<Box component="form" onSubmit={handleSubmit} noValidate>
							<Box sx={{ mb: 2.5 }}>
								<Typography variant="subtitle2" sx={{ mb: 1 }}>
									Receipt
								</Typography>
								<Box
									sx={{
										display: "flex",
										alignItems: { xs: "stretch", sm: "center" },
										flexDirection: { xs: "column", sm: "row" },
										gap: 1.5,
									}}
								>
									<Button
										component="label"
										variant="outlined"
										startIcon={<AttachFileIcon />}
										disabled={isReceiptBusy}
									>
										{isReceiptBusy ? "Reading..." : "Attach receipt"}
										<input
											hidden
											type="file"
											aria-label="Receipt file"
											accept="application/pdf,image/jpeg,image/jpg,image/png"
											onChange={handleReceiptChange}
										/>
									</Button>
									<Typography variant="body2" color="text.secondary">
										{values.receipt
											? values.receipt.fileName
											: "Required PDF, JPG, or PNG up to 10 MB. Details are extracted automatically when possible."}
									</Typography>
								</Box>
								{errors.receiptFile && (
									<Typography variant="caption" color="error">
										{errors.receiptFile}
									</Typography>
								)}
							</Box>

							<Box sx={{ mb: 2 }}>
								<ToggleButtonGroup
									exclusive
									fullWidth
									color="primary"
									value={values.submissionType}
									onChange={handleSubmissionTypeChange}
									aria-label="Submission type"
								>
									<ToggleButton value="reimbursement">
										Reimbursement
									</ToggleButton>
									<ToggleButton value="invoice">Invoice</ToggleButton>
								</ToggleButtonGroup>
							</Box>

							<Box
								sx={{
									display: "grid",
									gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
									gap: 2,
								}}
							>
								<TextField
									label="Amount"
									type="number"
									value={values.amount}
									onChange={(event) => setField("amount", event.target.value)}
									error={Boolean(errors.amount)}
									helperText={errors.amount}
									inputProps={{ min: "0", step: "0.01" }}
									required
								/>
								<TextField
									label="Date"
									type="date"
									value={values.date}
									onChange={(event) => setField("date", event.target.value)}
									error={Boolean(errors.date)}
									helperText={errors.date}
									slotProps={{ inputLabel: { shrink: true } }}
									required
								/>
								<TextField
									select
									label="Department"
									value={values.department}
									onChange={(event) =>
										setField("department", event.target.value)
									}
									error={Boolean(errors.department)}
									helperText={errors.department}
									required
									sx={{ gridColumn: "1 / -1" }}
								>
									{DEPARTMENTS.map((department) => (
										<MenuItem key={department} value={department}>
											{department}
										</MenuItem>
									))}
								</TextField>
								{showDepartmentWarning && (
									<Alert severity="warning" sx={{ gridColumn: "1 / -1" }}>
										This request is for a department different from your member
										department. Finance may ask for additional confirmation.
									</Alert>
								)}
								<TextField
									label="Description"
									value={values.description}
									onChange={(event) =>
										setField("description", event.target.value)
									}
									error={Boolean(errors.description)}
									helperText={errors.description}
									minRows={3}
									multiline
									required
									sx={{ gridColumn: "1 / -1" }}
								/>

								{isReimbursement && (
									<>
										<TextField
											label="IBAN"
											value={values.paymentIban}
											onChange={(event) =>
												setField("paymentIban", event.target.value)
											}
											error={Boolean(errors.paymentIban)}
											helperText={errors.paymentIban}
											required
										/>
										<TextField
											label="BIC"
											value={values.paymentBic}
											onChange={(event) =>
												setField("paymentBic", event.target.value)
											}
											error={Boolean(errors.paymentBic)}
											helperText={errors.paymentBic}
											required
										/>
									</>
								)}
							</Box>

							<Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
								<Button
									type="submit"
									variant="contained"
									disabled={isSubmitDisabled}
								>
									{isCreating ? "Submitting..." : "Submit request"}
								</Button>
							</Box>
						</Box>
					</CardContent>
				</GlassCard>
			</Box>
		</ToolPageShell>
	);
}
