import { Building2, ExternalLink, MapPin } from "lucide-react";
import {
	type Dispatch,
	type SetStateAction,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Markdown } from "@/components/ui/markdown";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/contexts/ToastContext";
import { useAdminData } from "@/hooks/useAdminData";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import {
	adminJobTypeLabels,
	getMemberDisplayName,
	getSafeHttpUrl,
} from "./adminRequests";
import type { JobPostingRequest } from "./adminTypes";

const CLAMP_HEIGHT_PX = 120;

export default function AdminJobRequestsPage() {
	const { showToast } = useToast();
	const {
		members,
		jobRequests,
		isLoading,
		error,
		reviewJobRequestAsync,
		removeJobRequestAsync,
	} = useAdminData();

	const [reviewingJobRequestIds, setReviewingJobRequestIds] = useState(
		() => new Set<string>(),
	);
	const [removingJobRequestIds, setRemovingJobRequestIds] = useState(
		() => new Set<string>(),
	);

	const allMembers = members ?? [];
	const pending = jobRequests.filter((request) => request.status === "pending");

	function setJobRequestPending(
		setter: Dispatch<SetStateAction<Set<string>>>,
		requestId: string,
		isPending: boolean,
	) {
		setter((currentIds) => {
			const nextIds = new Set(currentIds);
			if (isPending) {
				nextIds.add(requestId);
			} else {
				nextIds.delete(requestId);
			}
			return nextIds;
		});
	}

	async function reviewJobRequest(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		setJobRequestPending(setReviewingJobRequestIds, requestId, true);
		try {
			await reviewJobRequestAsync({ requestId, decision });
			showToast(`Job request ${decision}`, "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to review job request: ${errorMessage}`, "error");
		} finally {
			setJobRequestPending(setReviewingJobRequestIds, requestId, false);
		}
	}

	async function removeJobRequest(request: JobPostingRequest) {
		const confirmed = window.confirm(
			`Remove "${request.title}" from the job requests?`,
		);
		if (!confirmed) return;

		setJobRequestPending(setRemovingJobRequestIds, request.id, true);
		try {
			await removeJobRequestAsync(request.id);
			showToast("Job request removed", "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to remove job request: ${errorMessage}`, "error");
		} finally {
			setJobRequestPending(setRemovingJobRequestIds, request.id, false);
		}
	}

	return (
		<AdminRequestsLayout
			title="Job Posting Requests"
			description="Review and approve member-submitted job postings."
			isLoading={isLoading}
			error={error}
		>
			{pending.length === 0 ? (
				<GlassCard className="p-6">
					<p className="text-muted-foreground">
						No pending job posting requests.
					</p>
				</GlassCard>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					{pending.map((request) => (
						<JobRequestReviewCard
							key={request.id}
							request={request}
							requesterName={
								request.source === "partner_portal"
									? "Partner Portal"
									: getMemberDisplayName(allMembers, request.user_id)
							}
							isActionPending={
								reviewingJobRequestIds.has(request.id) ||
								removingJobRequestIds.has(request.id)
							}
							onReview={(decision) => reviewJobRequest(request.id, decision)}
							onRemove={() => removeJobRequest(request)}
						/>
					))}
				</div>
			)}
		</AdminRequestsLayout>
	);
}

function JobRequestReviewCard({
	request,
	requesterName,
	isActionPending,
	onReview,
	onRemove,
}: {
	request: JobPostingRequest;
	requesterName: string;
	isActionPending: boolean;
	onReview: (decision: "approved" | "rejected") => void;
	onRemove: () => void;
}) {
	const [detailOpen, setDetailOpen] = useState(false);
	const descriptionRef = useRef<HTMLDivElement>(null);
	const [isClamped, setIsClamped] = useState(false);
	const isPartnerPortalRequest = request.source === "partner_portal";
	const safeExternalUrl = getSafeHttpUrl(request.external_url);
	const jobTypeLabel = adminJobTypeLabels[request.job_type] ?? request.job_type;

	// Only clamp + offer "Read more" when the description actually overflows.
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
				<Button
					type="button"
					size="sm"
					onClick={stop(() => onReview("approved"))}
					disabled={isActionPending}
					aria-label={`Approve job posting request for ${requesterName}`}
				>
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
					Reject
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					onClick={stop(onRemove)}
					disabled={isActionPending}
					aria-label={`Remove job posting request for ${requesterName}`}
				>
					Remove
				</Button>
			</div>
		</div>
	);

	return (
		<>
			<GlassCard
				variant={isClamped ? "interactive" : undefined}
				className="h-full"
				role={isClamped ? "button" : undefined}
				tabIndex={isClamped ? 0 : undefined}
				aria-label={
					isClamped ? `View full posting for ${request.title}` : undefined
				}
				onClick={isClamped ? () => setDetailOpen(true) : undefined}
				onKeyDown={
					isClamped
						? (event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									setDetailOpen(true);
								}
							}
						: undefined
				}
			>
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
					<DialogHeader>{header}</DialogHeader>
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
