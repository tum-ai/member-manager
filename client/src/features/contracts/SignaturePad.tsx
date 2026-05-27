import { Box, Button, Stack } from "@mui/material";
import { useEffect, useRef, useState } from "react";

interface SignaturePadProps {
	onChange: (dataUrl: string | null) => void;
	height?: number;
}

export default function SignaturePad({
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
		canvas.setPointerCapture(event.pointerId);
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
		<Stack spacing={1}>
			<Box
				sx={{
					border: "1px solid",
					borderColor: "divider",
					borderRadius: 1,
					height,
					touchAction: "none",
					bgcolor: "background.paper",
				}}
			>
				<canvas
					ref={canvasRef}
					style={{ width: "100%", height: "100%", display: "block" }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
				/>
			</Box>
			<Stack direction="row" spacing={1}>
				<Button size="small" onClick={clear} disabled={isEmpty}>
					Löschen
				</Button>
			</Stack>
		</Stack>
	);
}
