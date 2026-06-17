import { CircleAlert, CircleCheck, Download, Save } from "lucide-react";
import type React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { GlassCard } from "../../../components/ui/GlassCard";
import { proxiedAvatarUrl } from "../../../lib/avatarUrl";
import { getMemberStatusLabel } from "../../../lib/memberMetadata";
import type { NavItem } from "../profileTypes";

interface ProfileSidebarProps {
	avatarUrl?: string | null;
	headerFullName: string;
	headerInitials: string;
	headerMeta: string;
	isActive: boolean;
	memberStatus?: string;
	completeness: number;
	isGeneratingPdf: boolean;
	canDownloadProof: boolean;
	onDownloadMembershipProof: () => void;
	navItems: NavItem[];
	activeSection: string;
	onNavClick: (event: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
	isUpdating: boolean;
}

export function ProfileSidebar({
	avatarUrl,
	headerFullName,
	headerInitials,
	headerMeta,
	isActive,
	memberStatus,
	completeness,
	isGeneratingPdf,
	canDownloadProof,
	onDownloadMembershipProof,
	navItems,
	activeSection,
	onNavClick,
	isUpdating,
}: ProfileSidebarProps): JSX.Element {
	return (
		<aside className="flex flex-col gap-4 self-start lg:col-span-4 lg:sticky lg:top-20">
			<GlassCard variant="elevated">
				<CardContent className="p-6">
					<div className="flex items-center gap-4">
						<Avatar className="size-16 shrink-0 bg-muted">
							<AvatarImage
								src={proxiedAvatarUrl(avatarUrl)}
								alt={headerFullName || "Member avatar"}
							/>
							<AvatarFallback className="bg-brand/10 text-lg font-semibold text-brand">
								{headerInitials}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<h1 className="truncate text-xl font-bold leading-tight">
								{headerFullName || "Your Profile"}
							</h1>
							{headerMeta && (
								<p className="mt-0.5 truncate text-sm text-muted-foreground">
									{headerMeta}
								</p>
							)}
						</div>
					</div>

					<Badge
						variant={isActive ? "success" : "neutral"}
						className="mt-4 gap-1.5 py-1"
					>
						{isActive ? (
							<CircleCheck className="size-[18px]" />
						) : (
							<CircleAlert className="size-[18px]" />
						)}
						{`${getMemberStatusLabel(memberStatus)} Member`}
					</Badge>

					<div className="mt-5">
						<div className="mb-1.5 flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Profile completeness
							</span>
							<span className="font-medium">{completeness}%</span>
						</div>
						<Progress value={completeness} />
					</div>

					<div className="my-5 border-t border-border" />

					<Button
						type="button"
						variant="outline"
						onClick={onDownloadMembershipProof}
						disabled={isGeneratingPdf || !canDownloadProof}
						className="w-full"
					>
						{isGeneratingPdf ? (
							<Spinner className="size-4" />
						) : (
							<Download className="size-4" />
						)}
						{isGeneratingPdf ? "Generating..." : "Proof of Membership"}
					</Button>
				</CardContent>
			</GlassCard>

			<GlassCard variant="elevated" className="hidden lg:block">
				<CardContent className="p-4">
					<p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						On this page
					</p>
					<nav className="flex flex-col">
						{navItems.map((item) => (
							<a
								key={item.id}
								href={`#${item.id}`}
								onClick={(event) => onNavClick(event, item.id)}
								className={cn(
									"rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
									activeSection === item.id
										? "font-medium text-brand"
										: "text-muted-foreground",
								)}
							>
								{item.label}
							</a>
						))}
					</nav>
				</CardContent>
			</GlassCard>

			<Button
				type="submit"
				size="lg"
				className="hidden w-full lg:flex"
				disabled={isUpdating}
			>
				{isUpdating ? (
					<Spinner className="size-5" />
				) : (
					<Save className="size-4" />
				)}
				{isUpdating ? "Saving..." : "Save Changes"}
			</Button>
		</aside>
	);
}
