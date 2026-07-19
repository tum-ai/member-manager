import { AlertTriangle, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { useAdminMemberMerge } from "@/features/admin/hooks/useAdminMemberMerge";
import { getMemberStatusLabel } from "@/lib/memberMetadata";

type AdminMemberMergeDialogProps = ReturnType<typeof useAdminMemberMerge>;

function getMemberDisplayName(
	member: NonNullable<
		AdminMemberMergeDialogProps["candidate"]
	>["members"][number],
) {
	const name = `${member.given_name} ${member.surname}`.trim();
	return name || member.email || member.user_id;
}

function getMemberOptionLabel(
	member: NonNullable<
		AdminMemberMergeDialogProps["candidate"]
	>["members"][number],
) {
	const status = getMemberStatusLabel(
		member.member_status || (member.active ? "active" : "inactive"),
	);
	const email = member.email ? ` - ${member.email}` : "";
	return `${getMemberDisplayName(member)}${email} - ${status}`;
}

export function AdminMemberMergeDialog({
	candidate,
	targetUserId,
	setTargetUserId,
	sourceUserId,
	setSourceUserId,
	note,
	setNote,
	closeMergeDialog,
	canMerge,
	mergeSelectedMembers,
	isMergingMembers,
}: AdminMemberMergeDialogProps) {
	const members = candidate?.members ?? [];
	const target = members.find((member) => member.user_id === targetUserId);
	const source = members.find((member) => member.user_id === sourceUserId);

	return (
		<Dialog open={Boolean(candidate)} onOpenChange={closeMergeDialog}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitMerge className="size-5 text-brand" />
						Merge duplicate members
					</DialogTitle>
					<DialogDescription>
						Choose the canonical target account. Profile fields from the target
						stay in place; requests, agreements, CVs, and history from the
						source move to the target.
					</DialogDescription>
				</DialogHeader>

				{candidate ? (
					<div className="grid gap-5">
						<div className="rounded-lg bg-brand/10 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{candidate.reason}
							</p>
							<p className="mt-1 text-muted-foreground">
								Confidence: {candidate.confidence}
							</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor="merge-target-member">Canonical target</Label>
								<Select value={targetUserId} onValueChange={setTargetUserId}>
									<SelectTrigger id="merge-target-member">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{members.map((member) => (
											<SelectItem key={member.user_id} value={member.user_id}>
												{getMemberOptionLabel(member)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									This profile remains visible after the merge.
								</p>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="merge-source-member">
									Source to merge away
								</Label>
								<Select value={sourceUserId} onValueChange={setSourceUserId}>
									<SelectTrigger id="merge-source-member">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{members.map((member) => (
											<SelectItem key={member.user_id} value={member.user_id}>
												{getMemberOptionLabel(member)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									This member row is removed after dependent records move.
								</p>
							</div>
						</div>

						{targetUserId === sourceUserId ? (
							<div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<p>Target and source must be different accounts.</p>
							</div>
						) : null}

						<div className="grid gap-2">
							<Label htmlFor="merge-note">Audit note</Label>
							<Textarea
								id="merge-note"
								value={note}
								onChange={(event) => setNote(event.target.value)}
								placeholder="Why these member records represent the same person"
								rows={3}
							/>
						</div>

						<div className="grid gap-3 rounded-lg bg-muted/45 p-4 text-sm md:grid-cols-2">
							<div>
								<p className="font-semibold">Target</p>
								<p className="mt-1 text-muted-foreground">
									{target ? getMemberOptionLabel(target) : "Select a target"}
								</p>
							</div>
							<div>
								<p className="font-semibold">Source</p>
								<p className="mt-1 text-muted-foreground">
									{source ? getMemberOptionLabel(source) : "Select a source"}
								</p>
							</div>
						</div>
					</div>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={closeMergeDialog}
						disabled={isMergingMembers}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={mergeSelectedMembers}
						disabled={!canMerge}
					>
						<GitMerge className="size-4" />
						{isMergingMembers ? "Merging..." : "Merge members"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
