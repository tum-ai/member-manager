import SearchIcon from "@mui/icons-material/Search";
import {
	Avatar,
	Box,
	ButtonBase,
	InputAdornment,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { MemberPath, PathColumn, PathGroup } from "./communityGraphUtils";
import { getDisplayName, getInitials } from "./communityGraphUtils";

interface CommunityGraphCanvasProps {
	columns: PathColumn[];
	paths: MemberPath[];
	matchesCount: number;
	search: string;
	onSearchChange: (value: string) => void;
	onDepartmentSelect: (department: string) => void;
	onSelectedMemberChange: (memberId: string) => void;
}

const PATH_COLORS = ["#9A64D9", "#7F52B6", "#523573", "#B891E6", "#6F49A3"];

export default function CommunityGraphCanvas({
	columns,
	paths,
	matchesCount,
	search,
	onSearchChange,
	onDepartmentSelect,
	onSelectedMemberChange,
}: CommunityGraphCanvasProps) {
	const theme = useTheme();
	const hasQuery = search.trim().length > 0;

	return (
		<Box
			sx={{
				position: "relative",
				minHeight: { xs: 560, md: 680 },
				borderRadius: 5,
				overflow: "hidden",
				background:
					theme.palette.mode === "light"
						? "linear-gradient(180deg, rgba(255,255,255,0.76), rgba(245,239,255,0.54))"
						: "linear-gradient(180deg, rgba(13,2,20,0.42), rgba(13,2,20,0.2))",
				boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.13)}`,
				"&::before": {
					content: '""',
					position: "absolute",
					inset: 0,
					backgroundImage: `radial-gradient(${alpha(theme.palette.primary.main, 0.22)} 1px, transparent 1px)`,
					backgroundSize: "30px 30px",
					opacity: theme.palette.mode === "light" ? 0.24 : 0.16,
				},
			}}
		>
			<GraphSearch
				search={search}
				matchesCount={matchesCount}
				onSearchChange={onSearchChange}
			/>
			<GraphSvg columns={columns} paths={paths} hasQuery={hasQuery} />
			{columns.map((column) => (
				<ColumnLabels key={column.id} column={column} />
			))}
			{columns.flatMap((column) =>
				column.groups.map((group) => (
					<GroupNode
						key={group.id}
						group={group}
						onDepartmentSelect={onDepartmentSelect}
					/>
				)),
			)}
			{paths
				.filter((path) => path.selected || path.match)
				.slice(0, 8)
				.map((path) => (
					<MemberEndpoint
						key={`${path.id}:endpoint`}
						path={path}
						onSelect={onSelectedMemberChange}
					/>
				))}
		</Box>
	);
}

function GraphSearch({
	search,
	matchesCount,
	onSearchChange,
}: {
	search: string;
	matchesCount: number;
	onSearchChange: (value: string) => void;
}) {
	const theme = useTheme();
	const hasQuery = search.trim().length > 0;

	return (
		<Box
			sx={{
				position: "absolute",
				zIndex: 10,
				top: { xs: 16, md: 20 },
				left: "50%",
				transform: "translateX(-50%)",
				width: {
					xs: "calc(100% - 28px)",
					md: "min(700px, calc(100% - 64px))",
				},
			}}
		>
			<TextField
				size="small"
				placeholder="Search the member graph…"
				value={search}
				onChange={(event) => onSearchChange(event.target.value)}
				slotProps={{
					input: {
						startAdornment: (
							<InputAdornment position="start">
								<SearchIcon fontSize="small" />
							</InputAdornment>
						),
					},
				}}
				sx={{
					"& .MuiOutlinedInput-root": {
						borderRadius: 999,
						bgcolor: alpha(
							"#0D0214",
							theme.palette.mode === "light" ? 0.78 : 0.72,
						),
						backdropFilter: "blur(28px) saturate(180%)",
						boxShadow: `0 18px 48px ${alpha("#0D0214", 0.18)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.12)}`,
						"& fieldset": { borderColor: alpha("#FFFFFF", 0.14) },
						"&:hover fieldset": { borderColor: alpha("#FFFFFF", 0.22) },
					},
					"& .MuiInputBase-input, & .MuiSvgIcon-root": { color: "#F5EFFF" },
					"& .MuiInputBase-input::placeholder": {
						color: alpha("#F5EFFF", 0.55),
						opacity: 1,
					},
				}}
			/>
			{hasQuery && (
				<Typography
					variant="caption"
					sx={{
						display: "block",
						mt: 1,
						textAlign: "center",
						color: "text.secondary",
					}}
				>
					{matchesCount} match{matchesCount === 1 ? "" : "es"} in current
					filters
				</Typography>
			)}
		</Box>
	);
}

function ColumnLabels({ column }: { column: PathColumn }) {
	return (
		<Typography
			variant="caption"
			sx={{
				position: "absolute",
				zIndex: 3,
				left: `${column.x}%`,
				top: 110,
				transform: "translateX(-50%)",
				fontWeight: 900,
				letterSpacing: "0.08em",
				textTransform: "uppercase",
				color: "text.secondary",
				whiteSpace: "nowrap",
			}}
		>
			{column.label}
		</Typography>
	);
}

function GroupNode({
	group,
	onDepartmentSelect,
}: {
	group: PathGroup;
	onDepartmentSelect: (department: string) => void;
}) {
	const theme = useTheme();
	const interactive = group.columnId === "team" && group.label !== "No team";
	return (
		<ButtonBase
			component="button"
			type="button"
			disabled={!interactive}
			onClick={() => onDepartmentSelect(group.label)}
			aria-label={`${group.label} ${group.helper} node with ${group.count} member${group.count === 1 ? "" : "s"}`}
			sx={{
				position: "absolute",
				zIndex: 5,
				left: `${group.x}%`,
				top: `${group.y}%`,
				transform: "translate(-50%, -50%)",
				display: "grid",
				justifyItems: "center",
				gap: 0.5,
				font: "inherit",
				color: "text.primary",
				cursor: interactive ? "pointer" : "default",
				"&.Mui-disabled": { color: "text.primary", opacity: 1 },
			}}
		>
			<Box
				sx={{
					width: 17 + Math.min(18, group.count * 3),
					height: 17 + Math.min(18, group.count * 3),
					borderRadius: "50%",
					bgcolor: alpha(
						theme.palette.background.paper,
						theme.palette.mode === "light" ? 0.88 : 0.68,
					),
					border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
					boxShadow: `0 12px 30px ${alpha(theme.palette.primary.dark, 0.12)}`,
				}}
			/>
			<Box
				sx={{
					px: 0.7,
					py: 0.25,
					borderRadius: 999,
					bgcolor: alpha(
						theme.palette.background.paper,
						theme.palette.mode === "light" ? 0.82 : 0.62,
					),
					maxWidth: 132,
				}}
			>
				<Typography
					variant="caption"
					sx={{
						display: "block",
						fontWeight: 800,
						lineHeight: 1.05,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{group.label}
				</Typography>
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ display: "block", lineHeight: 1 }}
				>
					{group.count} member{group.count === 1 ? "" : "s"}
				</Typography>
			</Box>
		</ButtonBase>
	);
}

function GraphSvg({
	columns,
	paths,
	hasQuery,
}: {
	columns: PathColumn[];
	paths: MemberPath[];
	hasQuery: boolean;
}) {
	const theme = useTheme();
	return (
		<Box
			component="svg"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			aria-hidden="true"
			sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
		>
			<rect x="0" y="0" width="100" height="100" fill="transparent" />
			{columns.map((column) => (
				<line
					key={column.id}
					x1={column.x}
					y1="17"
					x2={column.x}
					y2="90"
					stroke={alpha(theme.palette.text.primary, 0.1)}
					strokeWidth="0.18"
					strokeDasharray="1 1.8"
				/>
			))}
			{paths.map((path) => (
				<path
					key={path.id}
					d={createPath(path.points)}
					fill="none"
					stroke={PATH_COLORS[path.colorIndex]}
					strokeOpacity={getPathOpacity(path, hasQuery)}
					strokeWidth={path.selected ? 0.72 : path.match ? 0.58 : 0.28}
					strokeLinecap="round"
				/>
			))}
		</Box>
	);
}

function MemberEndpoint({
	path,
	onSelect,
}: {
	path: MemberPath;
	onSelect: (memberId: string) => void;
}) {
	const theme = useTheme();
	const end = path.points[path.points.length - 1];
	return (
		<ButtonBase
			component="button"
			type="button"
			onClick={() => onSelect(path.member.user_id)}
			aria-label={`Focus ${getDisplayName(path.member)}${path.reasons.length ? `. Shared signals: ${path.reasons.join(", ")}` : ""}`}
			sx={{
				position: "absolute",
				zIndex: 8,
				left: `${Math.min(96, end.x + 2)}%`,
				top: `${end.y}%`,
				transform: "translate(-50%, -50%)",
				borderRadius: 999,
				p: 0.35,
				"&:hover": { transform: "translate(-50%, -55%) scale(1.04)" },
			}}
		>
			<Avatar
				src={path.member.avatar_url || undefined}
				alt={getDisplayName(path.member)}
				sx={{
					width: path.selected ? 54 : 42,
					height: path.selected ? 54 : 42,
					fontSize: path.selected ? 17 : 13,
					fontWeight: 900,
					bgcolor: path.selected
						? theme.palette.primary.main
						: theme.palette.background.paper,
					color: path.selected ? "#FFFFFF" : theme.palette.text.primary,
					border: `1px solid ${alpha(theme.palette.primary.main, 0.32)}`,
					boxShadow: `0 16px 38px ${alpha(theme.palette.primary.dark, 0.18)}`,
				}}
			>
				{getInitials(path.member)}
			</Avatar>
		</ButtonBase>
	);
}

function createPath(points: MemberPath["points"]): string {
	return points.reduce((path, point, index) => {
		if (index === 0) return `M ${point.x} ${point.y}`;
		const previous = points[index - 1];
		const midX = (previous.x + point.x) / 2;
		return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
	}, "");
}

function getPathOpacity(path: MemberPath, hasQuery: boolean): number {
	if (path.selected) return 0.95;
	if (path.match) return 0.82;
	if (!hasQuery && path.connectedToSelection) return 0.48;
	return hasQuery ? 0.08 : 0.2;
}
