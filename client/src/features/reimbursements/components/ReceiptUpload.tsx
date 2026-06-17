import { FileCheck2, UploadCloud } from "lucide-react";
import type React from "react";
import type { ReactElement } from "react";
import type { ReceiptState } from "@/features/reimbursements/reimbursementSubmitUtils";
import { cn } from "@/lib/utils";

interface ReceiptUploadProps {
	receipt: ReceiptState | null;
	isReceiptBusy: boolean;
	isDraggingReceipt: boolean;
	receiptError?: string;
	onDraggingChange: (dragging: boolean) => void;
	onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ReceiptUpload({
	receipt,
	isReceiptBusy,
	isDraggingReceipt,
	receiptError,
	onDraggingChange,
	onDrop,
	onChange,
}: ReceiptUploadProps): ReactElement {
	return (
		<div className="mb-6">
			<label
				onDragOver={(event) => {
					event.preventDefault();
					if (!isReceiptBusy) onDraggingChange(true);
				}}
				onDragLeave={() => onDraggingChange(false)}
				onDrop={onDrop}
				className={cn(
					"flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors",
					"hover:border-brand/50 hover:bg-accent/40",
					isDraggingReceipt && "border-brand bg-brand/5",
					isReceiptBusy && "pointer-events-none opacity-70",
					receiptError && "border-destructive/60",
				)}
			>
				<span
					className={cn(
						"flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors",
						(isDraggingReceipt || receipt) && "bg-brand/10 text-brand",
					)}
				>
					{receipt ? (
						<FileCheck2 className="size-6" />
					) : (
						<UploadCloud className="size-6" />
					)}
				</span>
				<div className="grid gap-1">
					<p className="font-medium">
						{isReceiptBusy
							? "Reading receipt…"
							: receipt
								? receipt.fileName
								: "Drag & drop your receipt"}
					</p>
					<p className="text-sm text-muted-foreground">
						{receipt && !isReceiptBusy ? (
							<span className="text-brand">Click or drop to replace</span>
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
					onChange={onChange}
				/>
			</label>
			{!receipt && !isReceiptBusy && (
				<p className="mt-2 text-center text-xs text-muted-foreground">
					Details are extracted automatically when possible.
				</p>
			)}
			{receiptError && (
				<p className="mt-2 text-center text-xs text-destructive">
					{receiptError}
				</p>
			)}
		</div>
	);
}
