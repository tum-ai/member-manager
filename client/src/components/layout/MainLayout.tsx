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
import type { User } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "react-router-dom";

interface MainLayoutProps {
	children: React.ReactNode;
	user: User | null;
	onLogout: () => void;
}

export default function MainLayout({
	children,
	user,
	onLogout,
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
			}}
		>
			<AppBar
				position="sticky"
				elevation={0}
				sx={{
					backgroundColor: "rgba(18, 18, 18, 0.8)",
					backdropFilter: "blur(12px)",
					borderBottom: `1px solid ${theme.palette.divider}`,
				}}
			>
				<Toolbar sx={{ justifyContent: "space-between" }}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							cursor: "pointer",
						}}
						onClick={() => navigate("/")}
					>
						<img src="/img/logo.webp" alt="TUM.ai" style={{ height: 28 }} />
					</Box>

					<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
						<FormControl
							size="small"
							sx={{
								minWidth: { xs: 140, sm: 180 },
								"& .MuiOutlinedInput-root": {
									backgroundColor: "rgba(255, 255, 255, 0.04)",
								},
								"& .MuiOutlinedInput-notchedOutline": {
									borderColor: theme.palette.divider,
								},
								"& .MuiSelect-select": {
									py: 1,
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
									color: theme.palette.text.secondary,
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
									color: theme.palette.text.secondary,
									"&:hover": {
										color: theme.palette.primary.main,
										backgroundColor: "rgba(208, 188, 255, 0.1)",
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
					py: { xs: 3, md: 4 },
					maxWidth: 1200,
					mx: "auto",
					width: "100%",
				}}
			>
				{children}
			</Box>
		</Box>
	);
}
