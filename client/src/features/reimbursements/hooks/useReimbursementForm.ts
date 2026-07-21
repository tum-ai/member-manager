import { normalizeIban } from "@member-manager/shared";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	ALLOWED_RECEIPT_TYPES,
	defaultValues,
	type FormErrors,
	type FormValues,
	getErrorMessage,
	MAX_RECEIPT_BYTES,
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
		uploadReceiptAsync,
		isUploadingReceipt,
		parseReceiptAsync,
		isParsingReceipt,
	} = useReimbursementRequests(userId);
	const { member } = useMemberData(userId);
	const { sepa, isLoading: isSepaLoading } = useSepaData(userId);
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
	// Reimbursement and invoice submissions share one paymentIban/paymentBic
	// field, but must not leak into each other when the member switches
	// submission type mid-form. These drafts remember what was last shown for
	// each type so switching back restores it instead of the other type's
	// value. `null` means "not visited yet" (fall back to the profile
	// IBAN/BIC for reimbursement); an empty string is a deliberate clear and
	// must be kept as-is.
	const reimbursementDraft = useRef<{
		iban: string | null;
		bic: string | null;
	}>({ iban: null, bic: null });
	const invoiceDraft = useRef<{ iban: string | null; bic: string | null }>({
		iban: null,
		bic: null,
	});

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

	const isReceiptBusy =
		isReadingReceipt || isUploadingReceipt || isParsingReceipt;

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

		// Stash whatever is currently shown under the type being left (read from
		// the latest render's state, not from inside the setValues updater,
		// which must stay a pure function of its input), then restore the
		// target type's own draft. While the SEPA profile is still loading, a
		// blank reimbursement field doesn't yet mean "deliberately cleared" —
		// it's just the unset default — so keep it as "unvisited" (null) rather
		// than locking in a blank that would block the profile IBAN once it
		// arrives.
		if (values.submissionType === "reimbursement") {
			reimbursementDraft.current = {
				iban: values.paymentIban || (isSepaLoading ? null : ""),
				bic: values.paymentBic || (isSepaLoading ? null : ""),
			};
		} else {
			invoiceDraft.current = {
				iban: values.paymentIban,
				bic: values.paymentBic,
			};
		}
		const nextDraft =
			nextType === "reimbursement"
				? reimbursementDraft.current
				: invoiceDraft.current;

		setValues((current) => ({
			...current,
			submissionType: nextType,
			paymentIban:
				nextDraft.iban ?? (nextType === "reimbursement" ? profileIban : ""),
			paymentBic:
				nextDraft.bic ?? (nextType === "reimbursement" ? profileBic : ""),
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
			const uploadedReceipt = await uploadReceiptAsync({ file });
			const nextReceipt = {
				fileName: uploadedReceipt.fileName,
				mimeType: uploadedReceipt.mimeType,
				sizeBytes: uploadedReceipt.sizeBytes,
				storageBucket: uploadedReceipt.storageBucket,
				storagePath: uploadedReceipt.storagePath,
			};
			setField("receipt", nextReceipt);
			setErrors((current) => ({ ...current, receiptFile: undefined }));

			try {
				const parsedReceipt = await parseReceiptAsync({
					receipt_filename: nextReceipt.fileName,
					receipt_mime_type: nextReceipt.mimeType,
					receipt_storage_bucket: nextReceipt.storageBucket,
					receipt_storage_path: nextReceipt.storagePath,
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
				receiptFile: `Could not upload receipt: ${getErrorMessage(readError)}`,
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
			payment_iban: normalizeIban(values.paymentIban),
			payment_bic: values.paymentBic.trim(),
			receipt_filename: values.receipt?.fileName ?? "",
			receipt_mime_type: values.receipt?.mimeType ?? "",
			receipt_storage_bucket: values.receipt?.storageBucket ?? "",
			receipt_storage_path: values.receipt?.storagePath ?? "",
			receipt_size_bytes: values.receipt?.sizeBytes ?? null,
		};

		try {
			await createRequestAsync(payload);
			showToast("Reimbursement request submitted.", "success");
			reimbursementDraft.current = { iban: null, bic: null };
			invoiceDraft.current = { iban: null, bic: null };
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
