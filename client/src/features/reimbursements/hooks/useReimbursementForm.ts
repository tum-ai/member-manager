import type React from "react";
import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	ALLOWED_RECEIPT_TYPES,
	defaultValues,
	type FormErrors,
	type FormValues,
	getErrorMessage,
	MAX_RECEIPT_BYTES,
	readFileAsBase64,
	sortRequestsByDateDesc,
	validateForm,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import type {
	CreateReimbursementRequestPayload,
	ReimbursementSubmissionType,
} from "@/features/reimbursements/reimbursementTypes";
import { useMemberData } from "@/hooks/useMemberData";
import { useReimbursementRequests } from "@/hooks/useReimbursementRequests";
import { useSepaData } from "@/hooks/useSepaData";

export function useReimbursementForm(userId: string) {
	const { showToast } = useToast();
	const {
		requests,
		isLoading,
		error,
		createRequestAsync,
		isCreating,
		parseReceiptAsync,
		isParsingReceipt,
	} = useReimbursementRequests(userId);
	const { member } = useMemberData(userId);
	const { sepa } = useSepaData(userId);
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

	const isReceiptBusy = isReadingReceipt || isParsingReceipt;

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

	const isSubmitDisabled = isCreating || isReceiptBusy;
	const showDepartmentWarning =
		Boolean(memberDepartment) &&
		Boolean(values.department) &&
		values.department !== memberDepartment;
	const sortedRequests = sortRequestsByDateDesc(requests);

	return {
		values,
		errors,
		isLoading,
		error,
		isCreating,
		isReceiptBusy,
		isDraggingReceipt,
		setIsDraggingReceipt,
		isSubmitDisabled,
		showDepartmentWarning,
		sortedRequests,
		setField,
		handleSubmissionTypeChange,
		handleReceiptChange,
		handleReceiptDrop,
		handleSubmit,
	};
}
