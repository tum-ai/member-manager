import type {
	ContractPartnerComment,
	ContractSubmission,
} from "@member-manager/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Textarea } from "@/components/ui/textarea";

export function ContractSubmissionCommentsSection({
	submission,
	comments,
	commentsLoading,
	commentsError,
	hasLegacyComment,
	isContractsAdmin,
	internalComment,
	busy,
	onInternalCommentChange,
	onAddInternalReply,
}: {
	submission: ContractSubmission;
	comments: ContractPartnerComment[];
	commentsLoading: boolean;
	commentsError: Error | null;
	hasLegacyComment: boolean;
	isContractsAdmin: boolean;
	internalComment: string;
	busy: boolean;
	onInternalCommentChange: (value: string) => void;
	onAddInternalReply: () => void;
}): JSX.Element {
	return (
		<GlassCard className="p-6">
			<p className="mb-2 text-base font-medium">Comment history</p>
			{commentsLoading ? (
				<SkeletonRegion
					label="Loading comments"
					className="flex flex-col gap-4"
				>
					{Array.from({ length: 2 }).map((_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<div key={index} className="space-y-1.5">
							<Skeleton className="h-3 w-40" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>
					))}
				</SkeletonRegion>
			) : commentsError ? (
				<Alert variant="destructive">
					<AlertDescription>{commentsError.message}</AlertDescription>
				</Alert>
			) : comments.length > 0 || hasLegacyComment ? (
				<div className="flex flex-col gap-4">
					{comments.map((item, index) => (
						<div key={item.id}>
							{index > 0 ? <Separator className="mb-4" /> : null}
							<p className="text-xs text-muted-foreground">
								{item.author_type === "partner"
									? (item.author_name ?? "Partner")
									: (item.author_name ?? "TUM.ai")}{" "}
								- {new Date(item.created_at).toLocaleString()}
							</p>
							<p className="whitespace-pre-wrap">{item.comment}</p>
						</div>
					))}
					{hasLegacyComment ? (
						<div>
							<p className="text-xs text-muted-foreground">Partner</p>
							<p className="whitespace-pre-wrap">
								{submission.partner_comment}
							</p>
						</div>
					) : null}
				</div>
			) : (
				<p className="text-muted-foreground">No partner comments yet.</p>
			)}
			{isContractsAdmin ? (
				<div className="mt-4 flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="internal-reply">Internal reply</Label>
						<Textarea
							id="internal-reply"
							value={internalComment}
							onChange={(event) => onInternalCommentChange(event.target.value)}
							rows={3}
						/>
					</div>
					<div>
						<Button
							variant="outline"
							disabled={!internalComment.trim() || busy}
							onClick={onAddInternalReply}
						>
							Add internal reply
						</Button>
					</div>
				</div>
			) : null}
		</GlassCard>
	);
}
