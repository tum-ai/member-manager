import type {
	DoorPinImportRequest,
	DoorPinImportResult,
} from "@member-manager/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	type DoorPinSheetSkippedRow,
	parseTrakaUserSheet,
	type SheetCell,
} from "@/features/admin/doorPinImportUtils";
import { apiClient } from "@/lib/apiClient";

/** Reads the first sheet of an .xlsx file. Loaded on demand. */
export type ReadSheet = (file: File) => Promise<SheetCell[][]>;

const readFirstSheet: ReadSheet = async (file) => {
	const { readSheet } = await import("read-excel-file/browser");
	return (await readSheet(file)) as SheetCell[][];
};

type Step = "select" | "preview" | "done";

/**
 * The "Import door PINs" dialog: read the cabinet's user sheet in the
 * browser, show a server dry run of what would change, then apply it. Only
 * emails, names and PINs of the sheet's rows are sent; nothing is stored
 * before the admin confirms.
 */
export function useAdminDoorPinImport({
	readSheet = readFirstSheet,
}: {
	readSheet?: ReadSheet;
} = {}) {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const [isOpen, setIsOpen] = useState(false);
	const [step, setStep] = useState<Step>("select");
	const [fileName, setFileName] = useState("");
	const [isReadingFile, setIsReadingFile] = useState(false);
	const [fileError, setFileError] = useState<string | null>(null);
	const [rows, setRows] = useState<DoorPinImportRequest["rows"]>([]);
	const [skipped, setSkipped] = useState<DoorPinSheetSkippedRow[]>([]);
	const [result, setResult] = useState<DoorPinImportResult | null>(null);

	const importMutation = useMutation({
		mutationFn: async (request: DoorPinImportRequest) =>
			(await apiClient("/api/admin/door-pins/import", {
				method: "POST",
				body: JSON.stringify(request),
			})) as DoorPinImportResult,
	});

	const reset = (): void => {
		setStep("select");
		setFileName("");
		setIsReadingFile(false);
		setFileError(null);
		setRows([]);
		setSkipped([]);
		setResult(null);
		importMutation.reset();
	};

	const openDialog = (): void => {
		reset();
		setIsOpen(true);
	};

	const closeDialog = (): void => {
		if (importMutation.isPending) return;
		setIsOpen(false);
		reset();
	};

	const selectFile = async (file: File | undefined): Promise<void> => {
		if (!file) return;
		reset();
		setFileName(file.name);
		setIsReadingFile(true);
		try {
			const sheet = parseTrakaUserSheet(await readSheet(file));
			setRows(sheet.rows);
			setSkipped(sheet.skipped);
			setResult(
				await importMutation.mutateAsync({ dry_run: true, rows: sheet.rows }),
			);
			setStep("preview");
		} catch (error) {
			setFileError(
				error instanceof Error
					? error.message
					: "The file couldn't be read as an .xlsx sheet.",
			);
		} finally {
			setIsReadingFile(false);
		}
	};

	const applyImport = async (): Promise<void> => {
		if (rows.length === 0) return;
		try {
			const applied = await importMutation.mutateAsync({
				dry_run: false,
				rows,
			});
			setResult(applied);
			setStep("done");
			// Any open PIN view (an admin's editor, a profile) is now stale.
			queryClient.invalidateQueries({ queryKey: ["door-pin"] });
			const stored = applied.created + applied.updated;
			showToast(
				stored === 1 ? "Imported 1 door PIN." : `Imported ${stored} door PINs.`,
				"success",
			);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "The import failed.",
				"error",
			);
		}
	};

	const pendingChanges = result ? result.created + result.updated : 0;

	return {
		isOpen,
		openDialog,
		closeDialog,
		step,
		fileName,
		selectFile,
		isReadingFile,
		isApplying: importMutation.isPending && step === "preview",
		fileError,
		skipped,
		result,
		pendingChanges,
		applyImport,
	};
}

export type AdminDoorPinImportState = ReturnType<typeof useAdminDoorPinImport>;
