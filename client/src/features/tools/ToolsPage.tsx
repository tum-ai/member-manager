import {
	ArrowForward as ArrowForwardIcon,
	FactCheck as FactCheckIcon,
	ReceiptLong as ReceiptLongIcon,
	WorkspacePremium as WorkspacePremiumIcon,
} from "@mui/icons-material";
import {
	Box,
	CardActionArea,
	CardContent,
	Grid,
	Stack,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import type React from "react";
import { Link as RouterLink } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { useMemberData } from "../../hooks/useMemberData";
import { TOOL_CONTENT_MAX_WIDTH } from "./ToolPageShell";

interface ToolDefinition {
	title: string;
	description: string;
	href: string;
	Icon: typeof ReceiptLongIcon;
}

interface ToolGroup {
	title: string;
	tools: ToolDefinition[];
}

const baseToolGroups: ToolGroup[] = [
	{
		title: "General",
		tools: [
			{
				title: "Engagement Certificate",
				description:
					"Request an official certificate for your TUM.ai engagement after admin review.",
				href: "/tools/engagement-certificate",
				Icon: WorkspacePremiumIcon,
			},
		],
	},
	{
		title: "Finance",
		tools: [
			{
				title: "Reimbursement Tool",
				description:
					"Submit reimbursement requests for approved TUM.ai expenses and keep the process in one place.",
				href: "/tools/reimbursement",
				Icon: ReceiptLongIcon,
			},
			{
				title: "Finance Review",
				description:
					"Approve reimbursement and invoice requests, then mark approved requests as paid.",
				href: "/tools/reimbursement/review",
				Icon: FactCheckIcon,
			},
		],
	},
];

interface ToolsPageProps {
	user: User;
}

function canUseFinanceReview(
	member:
		| {
				active?: boolean | null;
				member_status?: string | null;
				department?: string | null;
		  }
		| null
		| undefined,
	isAdmin: boolean,
): boolean {
	if (isAdmin) {
		return true;
	}

	const status =
		member?.member_status || (member?.active ? "active" : "inactive");
	return status === "active" && member?.department === "Legal & Finance";
}

export default function ToolsPage({
	user,
}: ToolsPageProps): React.ReactElement {
	const { member } = useMemberData(user.id);
	const { isAdmin } = useIsAdmin(user.id);
	const showFinanceReview = canUseFinanceReview(member, isAdmin);
	const toolGroups = baseToolGroups
		.map((group) => ({
			...group,
			tools: group.tools.filter(
				(tool) =>
					tool.href !== "/tools/reimbursement/review" || showFinanceReview,
			),
		}))
		.filter((group) => group.tools.length > 0);

	return (
		<Box
			sx={{
				maxWidth: TOOL_CONTENT_MAX_WIDTH,
				mx: "auto",
				py: { xs: 2, md: 3 },
			}}
		>
			<Box sx={{ mb: { xs: 3, md: 4 } }}>
				<Typography variant="h3">Tools</Typography>
			</Box>

			<Box sx={{ display: "grid", gap: 4 }}>
				{toolGroups.map((group) => (
					<Box
						key={group.title}
						component="section"
						aria-labelledby={`${group.title}-tools-heading`}
					>
						<Box sx={{ mb: 1.5 }}>
							<Typography id={`${group.title}-tools-heading`} variant="h5">
								{group.title}
							</Typography>
						</Box>
						<Grid container spacing={2.5}>
							{group.tools.map((tool) => (
								<Grid key={tool.href} size={{ xs: 12, md: 6 }}>
									<ToolCard tool={tool} />
								</Grid>
							))}
						</Grid>
					</Box>
				))}
			</Box>
		</Box>
	);
}

interface ToolCardProps {
	tool: ToolDefinition;
}

function ToolCard({ tool }: ToolCardProps): React.ReactElement {
	const theme = useTheme();
	const Icon = tool.Icon;

	return (
		<GlassCard
			variant="interactive"
			sx={{ height: "100%", overflow: "hidden" }}
		>
			<CardActionArea
				component={RouterLink}
				to={tool.href}
				aria-label={tool.title}
				sx={{
					height: "100%",
					alignItems: "stretch",
					"&:focus-visible": {
						outline: `3px solid ${alpha(theme.palette.primary.main, 0.45)}`,
						outlineOffset: -3,
					},
				}}
			>
				<CardContent
					sx={{
						p: { xs: 3, md: 3.5 },
						height: "100%",
						display: "flex",
						flexDirection: "column",
						gap: 2.5,
					}}
				>
					<Stack direction="row" spacing={2} alignItems="flex-start">
						<Box
							sx={{
								width: 48,
								height: 48,
								borderRadius: 3,
								display: "grid",
								placeItems: "center",
								bgcolor: alpha(theme.palette.primary.main, 0.12),
								color: "primary.main",
								flexShrink: 0,
							}}
						>
							<Icon />
						</Box>
						<Box sx={{ minWidth: 0, flex: 1 }}>
							<Typography variant="h5">{tool.title}</Typography>
						</Box>
					</Stack>

					<Typography color="text.secondary" sx={{ flex: 1 }}>
						{tool.description}
					</Typography>

					<Stack
						direction="row"
						spacing={1}
						alignItems="center"
						color="primary.main"
					>
						<Typography variant="button">Open tool</Typography>
						<ArrowForwardIcon fontSize="small" />
					</Stack>
				</CardContent>
			</CardActionArea>
		</GlassCard>
	);
}
