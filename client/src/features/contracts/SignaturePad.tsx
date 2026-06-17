import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
	onChange: (dataUrl: string | null) => void;
	height?: number;
}

export function SignaturePad({
	onChange,
	height = 180,
}: SignaturePadProps): JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const drawingRef = useRef(false);
	const [isEmpty, setIsEmpty] = useState(true);

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

	return (
		<div className="flex flex-col gap-2">
			<div
				className="touch-none rounded-md border border-border bg-card"
				style={{ height }}
			>
				<canvas
					ref={canvasRef}
					style={{ width: "100%", height: "100%", display: "block" }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
				/>
			</div>
			<div className="flex flex-row gap-2">
				<Button variant="outline" size="sm" onClick={clear} disabled={isEmpty}>
					Clear
				</Button>
			</div>
		</div>
	);
}
