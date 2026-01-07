import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import DescriptionIcon from "@mui/icons-material/Description";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PolicyIcon from "@mui/icons-material/Policy";
import {
	AppBar,
	Box,
	Button,
	Drawer,
	IconButton,
	List,
	ListItem,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Toolbar,
	Tooltip,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

interface MainLayoutProps {
	children: React.ReactNode;
	user: User | null;
	userRole: string | null;
	onLogout: () => void;
	onOpenSepa: () => void;
	onOpenPrivacy: () => void;
}

export default function MainLayout({
	children,
	user,
	userRole,
	onLogout,
	onOpenSepa,
	onOpenPrivacy,
}: MainLayoutProps) {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [drawerOpen, setDrawerOpen] = useState(false);

	return (
		<>
			<AppBar position="static" elevation={0}>
				<Toolbar>
					{isMobile && (
						<IconButton
							edge="start"
							sx={{ mr: 2, color: theme.palette.primary.main }}
							aria-label="menu"
							onClick={() => setDrawerOpen(true)}
						>
							<MenuIcon />
						</IconButton>
					)}

					{/* TUM.ai Logo on the left */}
					<Box
						sx={{ display: "flex", alignItems: "center", mr: isMobile ? 0 : 4 }}
					>
						<img
							src="/img/logo.webp"
							alt="TUM.ai Logo"
							style={{ height: "24px" }}
						/>
					</Box>
					{!isMobile && (
						<Box sx={{ display: "flex", gap: 2, flexGrow: 1 }}>
							{userRole === "user" && (
								<Button color="inherit" component={RouterLink} to="/">
									<AccountCircleIcon sx={{ mr: 0.5 }} /> Member Form
								</Button>
							)}
							{userRole === "user" && (
								<Button color="inherit" component="a" onClick={onOpenSepa}>
									<DescriptionIcon sx={{ mr: 0.5 }} /> SEPA
								</Button>
							)}
							{userRole === "user" && (
								<Button color="inherit" component="a" onClick={onOpenPrivacy}>
									<PolicyIcon sx={{ mr: 0.5 }} /> Privacy Policy
								</Button>
							)}
							{userRole === "user" && (
								<Button
									color="inherit"
									component={RouterLink}
									to="/certificate"
								>
									<EmojiEventsIcon sx={{ mr: 0.5 }} /> Certificate
								</Button>
							)}
							{userRole === "admin" && (
								<Button color="inherit" component={RouterLink} to="/">
									<AdminPanelSettingsIcon sx={{ mr: 0.5 }} /> Admin
								</Button>
							)}
						</Box>
					)}

					{/* User Email and Logout Button on the right */}
					<Box
						sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 2 }}
					>
						{!isMobile && user?.email && (
							<Typography variant="body2" color="inherit">
								{user.email}
							</Typography>
						)}
						<Tooltip title="Logout">
							<IconButton
								sx={{ color: theme.palette.primary.main }}
								onClick={onLogout}
							>
								<LogoutIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Toolbar>
			</AppBar>

			<Drawer
				anchor="left"
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				PaperProps={{
					sx: {
						backgroundColor: theme.palette.background.paper,
						color: theme.palette.text.primary,
					},
				}}
			>
				<Box
					sx={{
						width: 250,
						pt: 2,
						pb: 2,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
					role="presentation"
					onClick={() => setDrawerOpen(false)}
					onKeyDown={() => setDrawerOpen(false)}
				>
					<img
						src="/img/logo.webp"
						alt="TUM.ai Logo"
						style={{
							height: "24px",
							marginBottom: "32px",
							paddingBottom: "32px",
						}}
					/>
					<List sx={{ width: "100%" }}>
						{userRole === "user" && (
							<ListItem disablePadding>
								<ListItemButton component={RouterLink} to="/">
									<ListItemIcon>
										<AccountCircleIcon
											sx={{ color: theme.palette.text.secondary }}
										/>
									</ListItemIcon>
									<ListItemText primary="Member Form" />
								</ListItemButton>
							</ListItem>
						)}
						{userRole === "user" && (
							<ListItem disablePadding>
								<ListItemButton component="a" onClick={onOpenSepa}>
									<ListItemIcon>
										<DescriptionIcon
											sx={{ color: theme.palette.text.secondary }}
										/>
									</ListItemIcon>
									<ListItemText primary="SEPA" />
								</ListItemButton>
							</ListItem>
						)}
						{userRole === "user" && (
							<ListItem disablePadding>
								<ListItemButton component="a" onClick={onOpenPrivacy}>
									<ListItemIcon>
										<PolicyIcon sx={{ color: theme.palette.text.secondary }} />
									</ListItemIcon>
									<ListItemText primary="Privacy Policy" />
								</ListItemButton>
							</ListItem>
						)}
						{userRole === "user" && (
							<ListItem disablePadding>
								<ListItemButton component={RouterLink} to="/certificate">
									<ListItemIcon>
										<EmojiEventsIcon
											sx={{ color: theme.palette.text.secondary }}
										/>
									</ListItemIcon>
									<ListItemText primary="Certificate" />
								</ListItemButton>
							</ListItem>
						)}
						{userRole === "admin" && (
							<ListItem disablePadding>
								<ListItemButton component={RouterLink} to="/">
									<ListItemIcon>
										<AdminPanelSettingsIcon
											sx={{ color: theme.palette.text.secondary }}
										/>
									</ListItemIcon>
									<ListItemText primary="Admin" />
								</ListItemButton>
							</ListItem>
						)}
						<ListItem disablePadding sx={{ mt: 2 }}>
							<ListItemButton onClick={onLogout}>
								<ListItemIcon>
									<LogoutIcon sx={{ color: theme.palette.primary.main }} />
								</ListItemIcon>
								<ListItemText
									primary="Logout"
									sx={{ color: theme.palette.primary.main }}
								/>
							</ListItemButton>
						</ListItem>
					</List>
				</Box>
			</Drawer>

			<Box
				component="main"
				sx={{
					backgroundColor: theme.palette.background.default,
					color: theme.palette.text.primary,
					minHeight: "calc(100vh - 64px)",
					paddingX: { xs: theme.spacing(2), md: theme.spacing(4) },
					paddingY: theme.spacing(3),
					overflow: "auto",
				}}
			>
				{children}
			</Box>
		</>
	);
}
