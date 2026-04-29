import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Typography } from "@mui/material";
import type React from "react";
import { Link as RouterLink } from "react-router-dom";

export const TOOL_CONTENT_MAX_WIDTH = 980;

interface ToolPageShellProps {
	title: string;
	description?: string;
	children: React.ReactNode;
}

export default function ToolPageShell({
	title,
	description,
	children,
}: ToolPageShellProps): React.ReactElement {
	return (
		<Box
			sx={{ maxWidth: TOOL_CONTENT_MAX_WIDTH, mx: "auto", p: { xs: 2, md: 3 } }}
		>
			<Button
				component={RouterLink}
				to="/tools"
				startIcon={<ArrowBackIcon />}
				sx={{ mb: 2 }}
			>
				Back to tools
			</Button>

			<Box sx={{ mb: 3 }}>
				<Typography variant="h4" sx={{ mb: description ? 1 : 0 }}>
					{title}
				</Typography>
				{description && (
					<Typography color="text.secondary">{description}</Typography>
				)}
			</Box>

			{children}
		</Box>
	);
}
