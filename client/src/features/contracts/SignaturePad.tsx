import { Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
	onChange: (dataUrl: string | null) => void;
	height?: number;
}

const MAX_SIGNATURE_PNG_BYTES = 1_400_000;

export function SignaturePad({
	onChange,
	height = 180,
}: SignaturePadProps): JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const fileInputId = useId();
	const drawingRef = useRef(false);
	const [isEmpty, setIsEmpty] = useState(true);
	const [uploadError, setUploadError] = useState<string | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		const ratio = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * ratio;
		canvas.height = rect.height * ratio;
		context.scale(ratio, ratio);
		context.lineWidth = 2;
		context.lineCap = "round";
		context.strokeStyle = "#111";
	}, []);

	function pointerPos(event: React.PointerEvent<HTMLCanvasElement>): {
		x: number;
		y: number;
	} {
		const rect = event.currentTarget.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
		setUploadError(null);
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		drawingRef.current = true;
		// Pointer capture is a best-effort optimization; it throws for
		// non-active/synthetic pointers (e.g. dispatched events in tests) and is
		// not required to draw, so failing to capture must not break signing.
		try {
			canvas.setPointerCapture(event.pointerId);
		} catch {
			// ignore — drawing still works without capture
		}
		const { x, y } = pointerPos(event);
		context.beginPath();
		context.moveTo(x, y);
	}

	function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
		if (!drawingRef.current) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		const { x, y } = pointerPos(event);
		context.lineTo(x, y);
		context.stroke();
	}

	function handlePointerUp() {
		if (!drawingRef.current) return;
		drawingRef.current = false;
		const canvas = canvasRef.current;
		if (!canvas) return;
		setIsEmpty(false);
		onChange(canvas.toDataURL("image/png"));
	}

	function clear() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		context.clearRect(0, 0, canvas.width, canvas.height);
		setIsEmpty(true);
		onChange(null);
	}

	function uploadPng(file: File | undefined): void {
		if (!file) return;
		if (file.type !== "image/png") {
			setUploadError("Choose a PNG image.");
			return;
		}
		if (file.size > MAX_SIGNATURE_PNG_BYTES) {
			setUploadError("The PNG must be smaller than 1.4 MB.");
			return;
		}

		const reader = new FileReader();
		reader.onerror = () => setUploadError("The PNG could not be read.");
		reader.onload = () => {
			if (typeof reader.result !== "string") {
				setUploadError("The PNG could not be read.");
				return;
			}
			setUploadError(null);
			setIsEmpty(false);
			onChange(reader.result);
		};
		reader.readAsDataURL(file);
	}

	return (
		<div className="flex flex-col gap-2">
			<p
				id={`${fileInputId}-instructions`}
				className="text-sm text-muted-foreground"
			>
				Draw with a pointer or touch. You can also upload a PNG signature.
			</p>
			<div
				className="touch-none rounded-md border border-border bg-card"
				style={{ height }}
			>
				<canvas
					ref={canvasRef}
					role="img"
					aria-label="Signature drawing area"
					aria-describedby={`${fileInputId}-instructions`}
					style={{ width: "100%", height: "100%", display: "block" }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onClick={clear} disabled={isEmpty}>
					Clear
				</Button>
				<Button variant="outline" size="sm" asChild>
					<label htmlFor={fileInputId}>
						<Upload className="size-4" />
						Upload PNG
					</label>
				</Button>
				<input
					id={fileInputId}
					type="file"
					accept="image/png,.png"
					className="sr-only"
					onChange={(event) => uploadPng(event.target.files?.[0])}
				/>
			</div>
			{uploadError ? (
				<p role="alert" className="text-sm text-destructive">
					{uploadError}
				</p>
			) : null}
		</div>
	);
}
