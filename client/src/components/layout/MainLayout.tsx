import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import {
	AppBar,
	Box,
	FormControl,
	IconButton,
	MenuItem,
	Select,
	type SelectChangeEvent,
	Toolbar,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppColorMode } from "../../theme";

interface MainLayoutProps {
	children: React.ReactNode;
	colorMode: AppColorMode;
	user: User | null;
	onLogout: () => void;
	onToggleColorMode: () => void;
}

export default function MainLayout({
	children,
	colorMode,
	user,
	onLogout,
	onToggleColorMode,
}: MainLayoutProps) {
	const theme = useTheme();
	const navigate = useNavigate();
	const location = useLocation();

	const navigationValue =
		location.pathname === "/members"
			? "/members"
			: location.pathname === "/" || location.pathname === "/profile"
				? "/"
				: "";

	const handleNavigationChange = (event: SelectChangeEvent<string>) => {
		const nextPath = event.target.value;

		if (nextPath) {
			navigate(nextPath);
		}
	};

	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				position: "relative",
				isolation: "isolate",
			}}
		>
			<Box
				aria-hidden
				sx={{
					position: "absolute",
					inset: 0,
					zIndex: -1,
					backgroundColor: theme.palette.background.default,
				}}
			/>

			<AppBar
				position="sticky"
				elevation={0}
				sx={{
					backgroundColor: "rgba(11, 2, 19, 0.76)",
					backdropFilter: "blur(18px)",
					borderBottom: `1px solid ${theme.palette.divider}`,
				}}
			>
				<Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							cursor: "pointer",
							gap: 2,
						}}
						onClick={() => navigate("/")}
					>
						<img
							src="/img/tum_ai_logo_new.svg"
							alt="TUM.ai"
							style={{ height: 34 }}
						/>
					</Box>

					<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
						<Tooltip
							title={
								colorMode === "light"
									? "Switch to night mode"
									: "Switch to light mode"
							}
						>
							<IconButton
								onClick={onToggleColorMode}
								size="small"
								sx={{
									color: "rgba(255, 255, 255, 0.78)",
									backgroundColor: "rgba(255, 255, 255, 0.06)",
									border: "1px solid rgba(255, 255, 255, 0.12)",
									"&:hover": {
										backgroundColor: "rgba(255, 255, 255, 0.12)",
									},
								}}
							>
								{colorMode === "light" ? (
									<DarkModeOutlinedIcon fontSize="small" />
								) : (
									<LightModeOutlinedIcon fontSize="small" />
								)}
							</IconButton>
						</Tooltip>

						<FormControl
							size="small"
							sx={{
								minWidth: { xs: 140, sm: 180 },
								"& .MuiOutlinedInput-root": {
									backgroundColor: "rgba(255, 255, 255, 0.06)",
									borderRadius: 999,
									color: "#ffffff",
								},
								"& .MuiOutlinedInput-notchedOutline": {
									borderColor: "rgba(255, 255, 255, 0.14)",
								},
								"& .MuiSvgIcon-root": {
									color: "#ffffff",
								},
								"& .MuiSelect-select": {
									py: 1.1,
									pr: 4,
								},
							}}
						>
							<Select
								displayEmpty
								value={navigationValue}
								onChange={handleNavigationChange}
								inputProps={{ "aria-label": "View selector" }}
							>
								<MenuItem disabled value="">
									Select view
								</MenuItem>
								<MenuItem value="/">My Profile</MenuItem>
								<MenuItem value="/members">All Members</MenuItem>
							</Select>
						</FormControl>

						{user?.email && (
							<Typography
								variant="body2"
								sx={{
									color: "rgba(255, 255, 255, 0.72)",
									display: { xs: "none", sm: "block" },
								}}
							>
								{user.email}
							</Typography>
						)}

						<Tooltip title="Logout">
							<IconButton
								onClick={onLogout}
								size="small"
								sx={{
									color: "rgba(255, 255, 255, 0.72)",
									backgroundColor: alpha("#FFFFFF", 0.03),
									"&:hover": {
										color: theme.palette.primary.light,
										backgroundColor: alpha("#FFFFFF", 0.08),
									},
								}}
							>
								<LogoutIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Box>
				</Toolbar>
			</AppBar>

			<Box
				component="main"
				sx={{
					flex: 1,
					px: { xs: 2, sm: 3, md: 4 },
					py: { xs: 3, md: 5 },
					maxWidth: 1280,
					mx: "auto",
					width: "100%",
					position: "relative",
				}}
			>
				{children}
			</Box>
		</Box>
	);
}
