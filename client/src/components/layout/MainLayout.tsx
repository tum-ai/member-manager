import type { User } from "@supabase/supabase-js";
import {
	Award,
	Briefcase,
	CalendarDays,
	ChevronRight,
	FileText,
	FolderKanban,
	LayoutGrid,
	LogOut,
	Moon,
	Network,
	Receipt,
	ScrollText,
	Search,
	Settings,
	ShieldCheck,
	Sun,
	User as UserIcon,
	Users,
	Workflow,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useToolAccess } from "../../hooks/useToolAccess";
import {
	TUM_AI_LOGO_MARK_DARK,
	TUM_AI_LOGO_MARK_LIGHT,
} from "../../lib/branding";
import BugReportButton from "./BugReportButton";

interface MainLayoutProps {
	children: React.ReactNode;
	user: User | null;
	isAdmin?: boolean;
	hasContractsAccess?: boolean;
	onLogout: () => void;
}

interface NavLeaf {
	label: string;
	to: string;
	icon: typeof Receipt;
}

export default function MainLayout({
	children,
	user,
	isAdmin = false,
	hasContractsAccess = false,
	onLogout,
}: MainLayoutProps) {
	const location = useLocation();
	const { permissions } = useToolAccess();

	const showFinanceReview = permissions.includes("finance.review");
	const showTumaiDays = permissions.includes("tumai_days.manage");

	const pathname = location.pathname;
	const isActive = (to: string) => pathname === to;
	const isWithin = (prefix: string) =>
		pathname === prefix || pathname.startsWith(`${prefix}/`);

	const toolItems: NavLeaf[] = [
		{ label: "Reimbursement", to: "/tools/reimbursement", icon: Receipt },
		{
			label: "Engagement Certificate",
			to: "/tools/engagement-certificate",
			icon: Award,
		},
		{ label: "Job Board", to: "/tools/jobs", icon: Briefcase },
		...(showTumaiDays
			? [
					{
						label: "TUM.ai Days",
						to: "/tools/tumai-days",
						icon: CalendarDays,
					} as NavLeaf,
				]
			: []),
		...(showFinanceReview
			? [
					{
						label: "Finance Review",
						to: "/tools/reimbursement/review",
						icon: ShieldCheck,
					} as NavLeaf,
				]
			: []),
	];

	const memberItems: NavLeaf[] = [
		{ label: "Browse", to: "/members", icon: Search },
		{ label: "Org Chart", to: "/members/org-chart", icon: Network },
		{ label: "Org Tree", to: "/members/org-tree", icon: Workflow },
		{ label: "Projects", to: "/members/projects", icon: FolderKanban },
	];

	const contractItems: NavLeaf[] = [
		{ label: "Create Contract", to: "/contracts", icon: FileText },
		{
			label: "Submissions",
			to: "/contracts/submissions",
			icon: ScrollText,
		},
		{ label: "Templates", to: "/contracts/templates", icon: Settings },
	];

	const adminItems: NavLeaf[] = [
		{ label: "Members", to: "/admin", icon: Users },
		{
			label: "Change Requests",
			to: "/admin/change-requests",
			icon: FileText,
		},
		{
			label: "Certificate Requests",
			to: "/admin/certificate-requests",
			icon: Award,
		},
		{ label: "Job Requests", to: "/admin/job-requests", icon: Briefcase },
	];

	const membersOpen = isWithin("/members");
	const toolsOpen = isWithin("/tools");
	// `/contracts` is a prefix of nothing else; the create page is exactly
	// `/contracts`, so treat the whole subtree as the contracts group.
	const contractsOpen = isWithin("/contracts");
	const adminOpen = isWithin("/admin");

	const userEmail = user?.email ?? "";
	const displayName = getDisplayName(user) || userEmail || "Account";
	const userInitial = displayName.charAt(0).toUpperCase() || "?";

	return (
		<SidebarProvider>
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								asChild
								tooltip="Member Manager"
								className="pointer-events-none group-data-[collapsible=icon]:!p-1.5"
							>
								<div>
									<img
										src={TUM_AI_LOGO_MARK_LIGHT}
										alt="TUM.ai"
										className="size-5 shrink-0 object-contain dark:hidden"
									/>
									<img
										src={TUM_AI_LOGO_MARK_DARK}
										alt="TUM.ai"
										className="hidden size-5 shrink-0 object-contain dark:block"
									/>
									<span className="font-semibold">Member Manager</span>
								</div>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={pathname === "/" || pathname === "/profile"}
									tooltip="Profile"
								>
									<RouterLink to="/">
										<UserIcon />
										<span>Profile</span>
									</RouterLink>
								</SidebarMenuButton>
							</SidebarMenuItem>

							<Collapsible
								asChild
								defaultOpen={membersOpen}
								className="group/collapsible"
							>
								<SidebarMenuItem>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton isActive={membersOpen} tooltip="Members">
											<Users />
											<span>Members</span>
											<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{memberItems.map((item) => (
												<SidebarMenuSubItem key={item.to}>
													<SidebarMenuSubButton
														asChild
														isActive={isActive(item.to)}
													>
														<RouterLink to={item.to}>
															<item.icon />
															<span>{item.label}</span>
														</RouterLink>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>

							{/* Tools — group of quick links; parent only toggles. */}
							<Collapsible
								asChild
								defaultOpen={toolsOpen}
								className="group/collapsible"
							>
								<SidebarMenuItem>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton isActive={toolsOpen} tooltip="Tools">
											<LayoutGrid />
											<span>Tools</span>
											<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{toolItems.map((item) => (
												<SidebarMenuSubItem key={item.to}>
													<SidebarMenuSubButton
														asChild
														isActive={isActive(item.to)}
													>
														<RouterLink to={item.to}>
															<item.icon />
															<span>{item.label}</span>
														</RouterLink>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>

							{hasContractsAccess && (
								<Collapsible
									asChild
									defaultOpen={contractsOpen}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton
												isActive={contractsOpen}
												tooltip="Contracts"
											>
												<FileText />
												<span>Contracts</span>
												<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{contractItems.map((item) => (
													<SidebarMenuSubItem key={item.to}>
														<SidebarMenuSubButton
															asChild
															isActive={isActive(item.to)}
														>
															<RouterLink to={item.to}>
																<item.icon />
																<span>{item.label}</span>
															</RouterLink>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							)}

							{isAdmin && (
								<Collapsible
									asChild
									defaultOpen={adminOpen}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton isActive={adminOpen} tooltip="Admin">
												<ShieldCheck />
												<span>Admin</span>
												<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{adminItems.map((item) => (
													<SidebarMenuSubItem key={item.to}>
														<SidebarMenuSubButton
															asChild
															isActive={isActive(item.to)}
														>
															<RouterLink to={item.to}>
																<item.icon />
																<span>{item.label}</span>
															</RouterLink>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							)}
						</SidebarMenu>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										size="lg"
										tooltip={userEmail || "Account"}
										className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
									>
										<div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-medium text-sidebar-primary-foreground">
											{userInitial}
										</div>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">
												{displayName}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{userEmail}
											</span>
										</div>
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									side="right"
									align="end"
									className="min-w-56"
								>
									<DropdownMenuLabel className="truncate font-normal text-muted-foreground">
										{userEmail || "Signed in"}
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={onLogout}>
										<LogOut />
										Log out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>

			<SidebarInset className="min-w-0">
				<header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					<SidebarTrigger className="-ml-1" />
					<ThemeToggleButton />
				</header>

				<main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
					{children}
				</main>

				<footer className="mx-auto w-full max-w-7xl px-4 pb-6 md:px-6">
					<BugReportButton user={user} />
				</footer>
			</SidebarInset>
		</SidebarProvider>
	);
}

function getDisplayName(user: User | null): string {
	const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
	const str = (key: string): string =>
		typeof metadata[key] === "string" ? (metadata[key] as string).trim() : "";

	const full = str("name") || str("full_name");
	if (full) return full;

	const given = str("given_name") || str("first_name");
	const family = str("family_name") || str("last_name");
	return [given, family].filter(Boolean).join(" ");
}

function ThemeToggleButton() {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<Button
			variant="ghost"
			size="icon"
			className="ml-auto"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? <Sun /> : <Moon />}
		</Button>
	);
}
