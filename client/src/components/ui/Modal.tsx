// Modern Modal with MUI Dialog and glassmorphism
import CloseIcon from "@mui/icons-material/Close";
import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	Slide,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
import React from "react";

interface ModalProps {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	onConfirm: () => void;
	confirmDisabled?: boolean;
	confirmLabel?: string;
	maxWidth?: "xs" | "sm" | "md" | "lg";
}

const SlideTransition = React.forwardRef(function SlideTransition(
	props: TransitionProps & { children: React.ReactElement },
	ref: React.Ref<unknown>,
) {
	return <Slide direction="up" ref={ref} {...props} />;
});

export default function Modal({
	title,
	onClose,
	children,
	onConfirm,
	confirmDisabled = false,
	confirmLabel = "Confirm",
	maxWidth = "md",
}: ModalProps) {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

	return (
		<Dialog
			open
			onClose={onClose}
			TransitionComponent={SlideTransition}
			fullScreen={isMobile}
			fullWidth
			maxWidth={maxWidth}
			PaperProps={{
				sx: {
					borderRadius: isMobile ? 0 : 3,
					// Theme-aware glass surface. Previously hard-coded to a dark
					// rgba, which made body copy (e.g. the SEPA mandate + privacy
					// policy text using theme.text.primary) unreadable in light
					// mode: dark-on-dark.
					backgroundColor:
						theme.palette.mode === "light"
							? "rgba(255, 255, 255, 0.96)"
							: "rgba(30, 30, 30, 0.95)",
					color: theme.palette.text.primary,
					backdropFilter: "blur(20px)",
					border: isMobile ? "none" : `1px solid ${theme.palette.divider}`,
				},
			}}
			slotProps={{
				backdrop: {
					sx: {
						backgroundColor:
							theme.palette.mode === "light"
								? "rgba(20, 16, 40, 0.35)"
								: "rgba(0, 0, 0, 0.7)",
						backdropFilter: "blur(4px)",
					},
				},
			}}
		>
			<DialogTitle
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					pb: 1,
				}}
			>
				<Box component="span" sx={{ fontWeight: 600 }}>
					{title}
				</Box>
				<IconButton
					onClick={onClose}
					size="small"
					sx={{
						color: theme.palette.text.secondary,
						"&:hover": {
							backgroundColor:
								theme.palette.mode === "light"
									? "rgba(0, 0, 0, 0.06)"
									: "rgba(255, 255, 255, 0.1)",
						},
					}}
					aria-label="Close"
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent dividers sx={{ borderColor: theme.palette.divider }}>
				{children}
			</DialogContent>

			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} variant="text" color="inherit">
					Cancel
				</Button>
				<Button
					onClick={onConfirm}
					variant="contained"
					disabled={confirmDisabled}
				>
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
