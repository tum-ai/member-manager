import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	ChevronRight,
	FileText,
	LayoutDashboard,
	LifeBuoy,
	type LucideIcon,
	Settings,
	Shield,
	Users,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "./breadcrumb";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./collapsible";
import { Separator } from "./separator";
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
	SidebarRail,
	SidebarTrigger,
} from "./sidebar";

// Placeholder navigation only — wiring real routes/items is out of scope here.
type Leaf = { title: string };
type NavItem = {
	title: string;
	icon: LucideIcon;
	items?: Leaf[];
};

const NAV: NavItem[] = [
	{ title: "Dashboard", icon: LayoutDashboard },
	{ title: "Members", icon: Users },
	{
		title: "Tools",
		icon: Wrench,
		items: [
			{ title: "Reimbursements" },
			{ title: "Certificates" },
			{ title: "Job Board" },
		],
	},
	{
		title: "Contracts",
		icon: FileText,
		items: [
			{ title: "Create" },
			{ title: "Templates" },
			{ title: "Submissions" },
		],
	},
	{ title: "Admin", icon: Shield },
];

function BrandHeader() {
	return (
		<SidebarHeader>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" className="gap-3">
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand font-semibold text-brand-foreground">
							t
						</div>
						<div className="grid flex-1 text-left leading-tight">
							<span className="truncate font-semibold">TUM.ai</span>
							<span className="truncate text-muted-foreground text-xs">
								Member Manager
							</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarHeader>
	);
}

function AppSidebar(
	props: Omit<React.ComponentProps<typeof Sidebar>, "onSelect"> & {
		active: string;
		onSelect: (key: string) => void;
	},
) {
	const { active, onSelect, ...sidebarProps } = props;
	return (
		<Sidebar {...sidebarProps}>
			<BrandHeader />
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Platform</SidebarGroupLabel>
					<SidebarMenu>
						{NAV.map((item) =>
							item.items ? (
								<Collapsible
									key={item.title}
									asChild
									defaultOpen={item.title === "Tools"}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton tooltip={item.title}>
												<item.icon />
												<span>{item.title}</span>
												<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{item.items.map((sub) => {
													const key = `${item.title}/${sub.title}`;
													return (
														<SidebarMenuSubItem key={sub.title}>
															<SidebarMenuSubButton
																asChild
																isActive={active === key}
															>
																<button
																	type="button"
																	onClick={() => onSelect(key)}
																>
																	{sub.title}
																</button>
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>
													);
												})}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							) : (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										tooltip={item.title}
										isActive={active === item.title}
										onClick={() => onSelect(item.title)}
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							),
						)}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton>
							<LifeBuoy />
							<span>Support</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton>
							<Settings />
							<span>Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function SidebarDemo(props: React.ComponentProps<typeof Sidebar>) {
	const [active, setActive] = useState("Dashboard");
	return (
		<SidebarProvider>
			<AppSidebar {...props} active={active} onSelect={setActive} />
			<SidebarInset>
				<header className="flex h-14 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="#">TUM.ai</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage>{active}</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-6">
					<div className="grid auto-rows-min gap-4 md:grid-cols-3">
						<div className="aspect-video rounded-xl bg-muted/60" />
						<div className="aspect-video rounded-xl bg-muted/60" />
						<div className="aspect-video rounded-xl bg-muted/60" />
					</div>
					<div className="min-h-64 flex-1 rounded-xl bg-muted/60" />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

const meta = {
	title: "UI/Sidebar",
	component: Sidebar,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => <SidebarDemo />,
};

export const IconCollapsible: Story = {
	render: () => <SidebarDemo collapsible="icon" />,
};

export const Inset: Story = {
	render: () => <SidebarDemo variant="inset" />,
};

export const Floating: Story = {
	render: () => <SidebarDemo variant="floating" />,
};
