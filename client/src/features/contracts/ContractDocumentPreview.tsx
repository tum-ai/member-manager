import { Box, CircularProgress, Stack, Typography } from "@mui/material";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

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
	pageMaxWidth = PAGE_WIDTH,
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
			<Stack
				spacing={2}
				alignItems="center"
				sx={{ minWidth: PAGE_WIDTH, width: "fit-content", mx: "auto" }}
			>
				{visiblePages.map((page) => (
					<Box
						// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated server-side from escaped contract text.
						dangerouslySetInnerHTML={{ __html: page }}
						data-contract-page
						key={page}
						sx={{
							bgcolor: "#fff",
							boxShadow:
								"0 18px 42px rgba(13, 2, 20, 0.14), 0 2px 8px rgba(13, 2, 20, 0.08)",
							color: "#0d0214",
							fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
							fontSize: "11px",
							height: PAGE_HEIGHT,
							lineHeight: 1.5,
							maxWidth: pageMaxWidth,
							minWidth: PAGE_WIDTH,
							overflow: "hidden",
							p: "11.9% 11.9% 9.5%",
							width: PAGE_WIDTH,
							"& h1": {
								fontSize: "20px",
								fontWeight: 700,
								letterSpacing: 0,
								lineHeight: 1.27,
								margin: "0 0 12pt",
								textAlign: "center",
							},
							"& h2": {
								fontSize: "11px",
								fontWeight: 700,
								letterSpacing: 0,
								lineHeight: 1.5,
								margin: "12pt 0 0",
							},
							"& p": {
								margin: "0 0 12pt",
								textAlign: "justify",
							},
							"& ul": {
								margin: "0 0 12pt 0",
								padding: 0,
							},
							"& li": {
								marginBottom: "0",
								marginLeft: "0.55cm",
								paddingLeft: "0.15cm",
								textAlign: "justify",
							},
							"& .list-continuation": {
								lineHeight: "17px",
								margin: "0 0 0 0.55cm",
								paddingLeft: "0.15cm",
								textAlign: "justify",
							},
							"& .blank-line": {
								height: "17px",
								lineHeight: "17px",
								margin: 0,
							},
						}}
					/>
				))}
			</Stack>
		</Box>
	);
}
