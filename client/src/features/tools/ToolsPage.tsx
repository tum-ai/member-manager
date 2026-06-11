import {
	ArrowForward as ArrowForwardIcon,
	Description as DescriptionIcon,
	FactCheck as FactCheckIcon,
	People as PeopleIcon,
	ReceiptLong as ReceiptLongIcon,
	RuleFolder as RuleFolderIcon,
	WorkOutline as WorkOutlineIcon,
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
import type React from "react";
import { Link as RouterLink } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";
import { useToolAccess } from "../../hooks/useToolAccess";
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
			{
				title: "Job Board",
				description:
					"Browse approved partner opportunities shared with active TUM.ai members.",
				href: "/tools/jobs",
				Icon: WorkOutlineIcon,
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
	{
		title: "Contracts",
		tools: [
			{
				title: "Create Contract",
				description:
					"Choose a template, fill in the variables, preview the contract, and submit it.",
				href: "/contracts",
				Icon: DescriptionIcon,
			},
			{
				title: "Contract Submissions",
				description:
					"Review submitted contracts, approve them, and generate signing links for partners.",
				href: "/contracts/submissions",
				Icon: FactCheckIcon,
			},
			{
				title: "Manage Templates",
				description:
					"Maintain contract templates, variables, and conditional blocks.",
				href: "/contracts/templates",
				Icon: RuleFolderIcon,
			},
		],
	},
	{
		title: "Community",
		tools: [
			{
				title: "TUM.ai Days RSVP",
				description:
					"Create, schedule, and audit RSVPs for the quarterly TUM.ai Days community events.",
				href: "/tools/tumai-days",
				Icon: PeopleIcon,
			},
		],
	},
];

export default function ToolsPage(): React.ReactElement {
	const { permissions } = useToolAccess();
	const showFinanceReview = permissions.includes("finance.review");
	// Contract admin tools (submissions list + templates editor) are gated by a
	// separate permission so a department could be granted one without the other.
	const showContractAdminTools = permissions.includes("contracts.admin");
	const showTumaiDaysTools = permissions.includes("tumai_days.manage");
	const toolGroups = baseToolGroups
		.map((group) => ({
			...group,
			tools: group.tools.filter((tool) => {
				if (tool.href === "/tools/reimbursement/review") {
					return showFinanceReview;
				}
				if (tool.href.startsWith("/contracts")) {
					return showContractAdminTools;
				}
				if (tool.href === "/tools/tumai-days") {
					return showTumaiDaysTools;
				}
				return true;
			}),
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
