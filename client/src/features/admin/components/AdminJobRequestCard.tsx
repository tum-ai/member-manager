import type { JobPostingRequest } from "@member-manager/shared";
import {
	Building2,
	Check,
	ExternalLink,
	MapPin,
	Pencil,
	Trash2,
	X,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Markdown } from "@/components/ui/markdown";
import { Separator } from "@/components/ui/separator";
import {
	adminJobTypeLabels,
	getSafeHttpUrl,
} from "@/features/admin/adminRequests";

const CLAMP_HEIGHT_PX = 120;

interface AdminJobRequestCardProps {
	request: JobPostingRequest;
	requesterName: string;
	isActionPending: boolean;
	onReview?: (decision: "approved" | "rejected") => void;
	onEdit?: () => void;
	onRemove: () => void;
}

export function AdminJobRequestCard({
	request,
	requesterName,
	isActionPending,
	onReview,
	onEdit,
	onRemove,
}: AdminJobRequestCardProps) {
	const [detailOpen, setDetailOpen] = useState(false);
	const descriptionRef = useRef<HTMLDivElement>(null);
	const [isClamped, setIsClamped] = useState(false);
	const isPartnerPortalRequest = request.source === "partner_portal";
	const safeExternalUrl = getSafeHttpUrl(request.external_url);
	const jobTypeLabel = adminJobTypeLabels[request.job_type] ?? request.job_type;

	useLayoutEffect(() => {
		const measure = () => {
			const element = descriptionRef.current;
			if (!element) return;
			setIsClamped(element.scrollHeight > CLAMP_HEIGHT_PX + 4);
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	const header = (
		<div className="flex items-start gap-4 text-left">
			<Avatar size="lg" className="size-[52px] rounded-md bg-brand/10">
				<AvatarImage
					src={request.logo_url ?? undefined}
					alt={request.organization_name}
				/>
				<AvatarFallback className="rounded-md bg-brand/10 text-brand">
					<Building2 className="size-5" />
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<div className="mb-0.5 flex flex-wrap items-center gap-2">
					<h2 className="text-xl font-semibold">{request.title}</h2>
					{isPartnerPortalRequest && (
						<Badge variant="accent">Partner Portal</Badge>
					)}
					{request.status === "approved" && (
						<Badge variant="success">Published</Badge>
					)}
					{request.status === "rejected" && (
						<Badge variant="danger">Rejected</Badge>
					)}
				</div>
				<p className="text-muted-foreground">{request.organization_name}</p>
			</div>
		</div>
	);

	const badges = (
		<div className="flex flex-wrap gap-2">
			<Badge variant="secondary">{jobTypeLabel}</Badge>
			<Badge variant="outline" className="gap-1 text-muted-foreground">
				<MapPin className="size-3.5" />
				{request.location}
			</Badge>
		</div>
	);

	const meta = (
		<div className="text-left text-sm text-muted-foreground">
			<p>
				{isPartnerPortalRequest ? "Submitted via" : "Member"}: {requesterName}
			</p>
			<p>
				Contact: {request.contact_name} ({request.contact_email})
			</p>
		</div>
	);

	const stop =
		(handler: () => void) => (event: { stopPropagation: () => void }) => {
			event.stopPropagation();
			handler();
		};
	const edit = () => {
		setDetailOpen(false);
		onEdit?.();
	};

	const actions = (
		<div className="flex flex-wrap items-center gap-2">
			{safeExternalUrl && (
				<Button
					variant="ghost"
					size="sm"
					asChild
					onClick={(event) => event.stopPropagation()}
				>
					<a href={safeExternalUrl} target="_blank" rel="noopener noreferrer">
						Open posting
						<ExternalLink className="size-4" />
					</a>
				</Button>
			)}
			<div className="ml-auto flex flex-wrap items-center gap-2">
				{onEdit && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={stop(edit)}
						disabled={isActionPending}
						aria-label={`Edit job posting ${request.title}`}
					>
						<Pencil className="size-4" />
						Edit
					</Button>
				)}
				{onReview && (
					<>
						<Button
							type="button"
							size="sm"
							className="bg-[#9A64D9] text-white hover:bg-[#523573]"
							onClick={stop(() => onReview("approved"))}
							disabled={isActionPending}
							aria-label={`Approve job posting request for ${requesterName}`}
						>
							<Check className="size-4" />
							Approve
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={stop(() => onReview("rejected"))}
							disabled={isActionPending}
							aria-label={`Reject job posting request for ${requesterName}`}
						>
							<X className="size-4" />
							Reject
						</Button>
					</>
				)}
				<Button
					type="button"
					variant="destructive"
					size="sm"
					onClick={stop(onRemove)}
					disabled={isActionPending}
					aria-label={`Remove job posting request for ${requesterName}`}
				>
					<Trash2 className="size-4" />
					Remove
				</Button>
			</div>
		</div>
	);

	return (
		<>
			<GlassCard className="h-full">
				<div className="flex h-full flex-col gap-5 p-5 md:p-6">
					{header}
					{badges}
					<div>
						<div
							ref={descriptionRef}
							style={
								isClamped
									? { maxHeight: CLAMP_HEIGHT_PX, overflow: "hidden" }
									: undefined
							}
						>
							<Markdown className="text-muted-foreground">
								{request.description_markdown}
							</Markdown>
						</div>
						{isClamped && (
							<button
								type="button"
								className="mt-1 text-sm font-medium text-brand hover:underline"
								onClick={(event) => {
									event.stopPropagation();
									setDetailOpen(true);
								}}
							>
								Read more
							</button>
						)}
					</div>
					<div className="flex-1" />
					<Separator />
					{meta}
					{actions}
				</div>
			</GlassCard>

			<Dialog open={detailOpen} onOpenChange={setDetailOpen}>
				<DialogContent className="max-h-[85vh] gap-5 overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle className="sr-only">{request.title}</DialogTitle>
						<DialogDescription className="sr-only">
							Full job posting details.
						</DialogDescription>
						{header}
					</DialogHeader>
					{badges}
					<Markdown className="text-muted-foreground">
						{request.description_markdown}
					</Markdown>
					<Separator />
					{meta}
					{actions}
				</DialogContent>
			</Dialog>
		</>
	);
}
