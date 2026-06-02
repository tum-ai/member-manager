import { Box, CircularProgress, Stack, Typography } from "@mui/material";

interface ContractDocumentPreviewProps {
	pages?: string[];
	loading?: boolean;
	emptyLabel?: string;
	maxHeight?: string | Record<string, string>;
	minHeight?: number | string | Record<string, number | string>;
	pageMaxWidth?: number | string | Record<string, number | string>;
}

export default function ContractDocumentPreview({
	pages,
	loading = false,
	emptyLabel = "No preview available",
	maxHeight = { xs: "70vh", lg: "calc(100vh - 220px)" },
	minHeight = 320,
	pageMaxWidth = 760,
}: ContractDocumentPreviewProps): JSX.Element {
	if (loading) {
		return (
			<Box sx={{ display: "grid", minHeight, placeItems: "center" }}>
				<CircularProgress size={28} />
			</Box>
		);
	}

	const visiblePages = pages && pages.length > 0 ? pages : [];
	if (visiblePages.length === 0) {
		return (
			<Box
				sx={{
					bgcolor: "action.hover",
					borderRadius: 1,
					display: "grid",
					minHeight,
					placeItems: "center",
				}}
			>
				<Typography color="text.secondary" variant="body2">
					{emptyLabel}
				</Typography>
			</Box>
		);
	}

	return (
		<Box
			data-contract-preview
			sx={{
				bgcolor: (theme) =>
					theme.palette.mode === "dark" ? "rgba(245,239,255,0.08)" : "#efefef",
				borderRadius: 1,
				maxHeight,
				minHeight,
				overflow: "auto",
				p: { xs: 1, sm: 1.5 },
			}}
		>
			<Stack spacing={2} alignItems="center">
				{visiblePages.map((page) => (
					<Box
						// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated server-side from escaped contract text.
						dangerouslySetInnerHTML={{ __html: page }}
						data-contract-page
						key={page}
						sx={{
							aspectRatio: "210 / 297",
							bgcolor: "#fff",
							boxShadow:
								"0 18px 42px rgba(13, 2, 20, 0.14), 0 2px 8px rgba(13, 2, 20, 0.08)",
							color: "#0d0214",
							fontFamily: 'Georgia, "Times New Roman", Times, serif',
							fontSize: { xs: "7px", sm: "9px", md: "11px", xl: "12px" },
							lineHeight: 1.48,
							maxWidth: pageMaxWidth,
							minWidth: 0,
							overflow: "hidden",
							p: { xs: "9% 8%", sm: "8.5% 8%" },
							width: "100%",
							"& h1": {
								fontSize: "1.55em",
								fontWeight: 700,
								letterSpacing: 0,
								lineHeight: 1.18,
								margin: "0 0 1.4em",
								textAlign: "center",
							},
							"& h2": {
								fontSize: "1.06em",
								fontWeight: 700,
								letterSpacing: 0,
								lineHeight: 1.35,
								margin: "1.15em 0 0.45em",
							},
							"& p": {
								margin: "0 0 0.78em",
								textAlign: "justify",
							},
							"& ul": {
								margin: "0 0 0.8em 1.2em",
								padding: 0,
							},
							"& li": {
								marginBottom: "0.2em",
								paddingLeft: "0.2em",
							},
						}}
					/>
				))}
			</Stack>
		</Box>
	);
}
