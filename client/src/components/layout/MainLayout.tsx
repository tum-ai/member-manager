import type { User } from "@supabase/supabase-js";
import {
	Award,
	Briefcase,
	CalendarDays,
	ChartColumnBig,
	ChevronRight,
	FileText,
	FlaskConical,
	Handshake,
	HeartHandshake,
	LogOut,
	type LucideIcon,
	Moon,
	Network,
	Receipt,
	ReceiptText,
	Scale,
	ScrollText,
	Search,
	Settings,
	ShieldCheck,
	Sun,
	Target,
	User as UserIcon,
	Users,
	Wallet,
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
	SidebarGroupLabel,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToolAccess } from "@/hooks/useToolAccess";
import { TUM_AI_LOGO_MARK_DARK, TUM_AI_LOGO_MARK_LIGHT } from "@/lib/branding";
import { BugReportButton } from "./BugReportButton";

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
	icon: LucideIcon;
	/** Omitted means visible; set false to gate by permission/breakpoint. */
	visible?: boolean;
}

/** A collapsible group of leaves — e.g. one department inside the Tools section. */
interface NavFolder {
	key: string;
	label: string;
	icon: LucideIcon;
	/**
	 * Extra route prefixes that mark this folder active/open (for sub-pages not
	 * present as items, e.g. a submission detail view). The folder is also
	 * active whenever the current route exactly matches one of its items, so
	 * `match` is only needed for deeper routes.
	 */
	match?: string[];
	items: NavLeaf[];
	visible?: boolean;
}

/** A labeled section (the "middle title") holding leaves and/or folders. */
interface NavSection {
	key: string;
	label?: string;
	entries: Array<NavLeaf | NavFolder>;
	visible?: boolean;
}

const isFolder = (entry: NavLeaf | NavFolder): entry is NavFolder =>
	"items" in entry;

// Profile lives at `/` (and the legacy `/profile` redirect), so it can't use a
// plain prefix match — that would light up for every route.
const isLeafActive = (pathname: string, to: string) =>
	to === "/" ? pathname === "/" || pathname === "/profile" : pathname === to;

const isWithinPrefix = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`);

export function MainLayout({
	children,
	user,
	isAdmin = false,
	hasContractsAccess = false,
	onLogout,
}: MainLayoutProps) {
	const location = useLocation();
	const isMobile = useIsMobile();
	const { permissions } = useToolAccess();

	const showFinanceReview = permissions.includes("finance.review");
	const showTumaiDays = permissions.includes("tumai_days.manage");
	const isContractsAdmin = isAdmin || permissions.includes("contracts.admin");

	const pathname = location.pathname;

	const sections: NavSection[] = [
		{
			key: "home",
			entries: [{ label: "Profile", to: "/", icon: UserIcon }],
		},
		{
			key: "tumai",
			label: "TUM.ai",
			entries: [
				{
					key: "members",
					label: "Members",
					icon: Users,
					items: [
						{ label: "Browse", to: "/members", icon: Search },
						{ label: "Org Chart", to: "/members/org-chart", icon: Network },
						{
							label: "Org Tree",
							to: "/members/org-tree",
							icon: Workflow,
							visible: !isMobile,
						},
					],
				},
				{ label: "Research", to: "/members/research", icon: FlaskConical },
				{ label: "Task Forces", to: "/members/innovation", icon: Target },
			],
		},
		{
			key: "tools",
			label: "Tools",
			entries: [
				{
					key: "legal",
					label: "Legal",
					icon: Scale,
					// `/contracts` is the create page and a prefix of every other
					// contract route, so it covers the whole subtree.
					match: ["/contracts"],
					visible: hasContractsAccess,
					items: [
						{ label: "Create Contract", to: "/contracts", icon: FileText },
						{
							label: "Submissions",
							to: "/contracts/submissions",
							icon: ScrollText,
						},
						{
							label: "Templates",
							to: "/contracts/templates",
							icon: Settings,
							visible: isContractsAdmin,
						},
					],
				},
				{
					key: "finance",
					label: "Finance",
					icon: Wallet,
					// Finance Review lives under `/tools/reimbursement/review`.
					match: ["/tools/reimbursement", "/tools/finance"],
					items: [
						{
							label: "Reimbursement",
							to: "/tools/reimbursement",
							icon: Receipt,
						},
						{
							label: "Finance Review",
							to: "/tools/reimbursement/review",
							icon: ShieldCheck,
							visible: showFinanceReview,
						},
						{
							label: "Transactions",
							to: "/tools/finance/buchhaltungsbutler",
							icon: ReceiptText,
							visible: showFinanceReview,
						},
						{
							label: "Analytics",
							to: "/tools/finance/analytics",
							icon: ChartColumnBig,
							visible: showFinanceReview,
						},
					],
				},
				{
					key: "tools-community",
					label: "Community",
					icon: HeartHandshake,
					items: [
						{
							label: "Engagement Certificate",
							to: "/tools/engagement-certificate",
							icon: Award,
						},
						{
							label: "TUM.ai Days",
							to: "/tools/tumai-days",
							icon: CalendarDays,
							visible: showTumaiDays,
						},
					],
				},
				{
					key: "partners",
					label: "Partners & Sponsors",
					icon: Handshake,
					match: ["/tools/jobs"],
					items: [{ label: "Job Board", to: "/tools/jobs", icon: Briefcase }],
				},
			],
		},
		{
			key: "administration",
			label: "Administration",
			visible: isAdmin,
			entries: [
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
			],
		},
	];

	// Drop hidden leaves, then empty folders, then empty/hidden sections so we
	// never render an empty department or a bare section label.
	const visibleSections = sections
		.filter((section) => section.visible !== false)
		.map((section) => ({
			...section,
			entries: section.entries
				.filter((entry) => entry.visible !== false)
				.map((entry) =>
					isFolder(entry)
						? {
								...entry,
								items: entry.items.filter((i) => i.visible !== false),
							}
						: entry,
				)
				.filter((entry) => !isFolder(entry) || entry.items.length > 0),
		}))
		.filter((section) => section.entries.length > 0);

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
					{visibleSections.map((section) => (
						<SidebarGroup key={section.key}>
							{section.label && (
								<SidebarGroupLabel>{section.label}</SidebarGroupLabel>
							)}
							<SidebarMenu>
								{section.entries.map((entry) =>
									isFolder(entry) ? (
										<NavFolderItem
											key={entry.key}
											folder={entry}
											pathname={pathname}
										/>
									) : (
										<NavLeafItem
											key={entry.to}
											leaf={entry}
											pathname={pathname}
										/>
									),
								)}
							</SidebarMenu>
						</SidebarGroup>
					))}
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

function NavLeafItem({ leaf, pathname }: { leaf: NavLeaf; pathname: string }) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={isLeafActive(pathname, leaf.to)}
				tooltip={leaf.label}
			>
				<RouterLink to={leaf.to}>
					<leaf.icon />
					<span>{leaf.label}</span>
				</RouterLink>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function NavFolderItem({
	folder,
	pathname,
}: {
	folder: NavFolder;
	pathname: string;
}) {
	const open =
		folder.items.some((item) => pathname === item.to) ||
		(folder.match?.some((prefix) => isWithinPrefix(pathname, prefix)) ?? false);

	return (
		<Collapsible asChild defaultOpen={open} className="group/collapsible">
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton isActive={open} tooltip={folder.label}>
						<folder.icon />
						<span>{folder.label}</span>
						<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{folder.items.map((item) => (
							<SidebarMenuSubItem key={item.to}>
								<SidebarMenuSubButton asChild isActive={pathname === item.to}>
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
