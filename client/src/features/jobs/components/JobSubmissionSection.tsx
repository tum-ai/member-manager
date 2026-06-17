import { Plus, Send } from "lucide-react";
import type React from "react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Textarea } from "@/components/ui/textarea";
import {
	getStatusBadgeVariant,
	type JobSubmissionFormState,
	jobTypeLabels,
	jobTypeOptions,
} from "@/features/jobs/jobPostingsUtils";
import type { JobPostingRequest } from "@/hooks/useJobs";

export function JobSubmissionPanel({
	requests,
	onOpenForm,
}: {
	requests: JobPostingRequest[];
	onOpenForm: () => void;
}): React.ReactElement {
	return (
		<GlassCard variant="elevated">
			<div className="p-5 md:p-6">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<h2 className="text-xl font-semibold">Member job submissions</h2>
						<p className="mt-0.5 text-muted-foreground">
							Approved member postings are published on the board.
						</p>
					</div>
					<Button type="button" onClick={onOpenForm}>
						<Plus className="size-4" />
						Post job
					</Button>
				</div>

				<Separator className="my-5" />

				{requests.length === 0 ? (
					<p className="text-muted-foreground">No submitted jobs yet.</p>
				) : (
					<div className="flex flex-col gap-3">
						{requests.map((request) => (
							<div
								key={request.id}
								className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
							>
								<div className="min-w-0">
									<p className="font-bold">{request.title}</p>
									<p className="text-sm text-muted-foreground">
										{request.organization_name} ·{" "}
										{jobTypeLabels[request.job_type]} · {request.location}
									</p>
								</div>
								<Badge
									variant={getStatusBadgeVariant(request.status)}
									className="capitalize"
								>
									{request.status}
								</Badge>
							</div>
						))}
					</div>
				)}
			</div>
		</GlassCard>
	);
}

export function JobSubmissionPanelSkeleton(): React.ReactElement {
	return (
		<SkeletonRegion label="Loading job submissions">
			<GlassCard variant="elevated">
				<div className="p-5 md:p-6">
					<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
						<div className="space-y-1.5">
							<Skeleton className="h-6 w-56" />
							<Skeleton className="h-4 w-72 max-w-full" />
						</div>
						<Skeleton className="h-9 w-28 rounded-md" />
					</div>
					<Separator className="my-5" />
					<div className="flex flex-col gap-3">
						{Array.from({ length: 3 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							<div key={i} className="flex items-center justify-between gap-3">
								<div className="min-w-0 flex-1 space-y-1.5">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-56 max-w-full" />
								</div>
								<Skeleton className="h-5 w-20 rounded-full" />
							</div>
						))}
					</div>
				</div>
			</GlassCard>
		</SkeletonRegion>
	);
}

export function JobSubmissionDialog({
	open,
	form,
	isSubmitting,
	onClose,
	onChange,
	onSubmit,
}: {
	open: boolean;
	form: JobSubmissionFormState;
	isSubmitting: boolean;
	onClose: () => void;
	onChange: (field: keyof JobSubmissionFormState, value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}): React.ReactElement {
	const fieldId = useId();
	const id = (name: string) => `${fieldId}-${name}`;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent className="sm:max-w-2xl">
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Post a job</DialogTitle>
					</DialogHeader>
					<div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-12">
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-7">
							<Label htmlFor={id("title")}>Job title</Label>
							<Input
								id={id("title")}
								required
								value={form.title}
								onChange={(event) => onChange("title", event.target.value)}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-5">
							<Label htmlFor={id("organization")}>Organization</Label>
							<Input
								id={id("organization")}
								required
								value={form.organization_name}
								onChange={(event) =>
									onChange("organization_name", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 sm:col-span-6">
							<Label htmlFor={id("job_type")}>Job type</Label>
							<Select
								value={form.job_type}
								onValueChange={(value) => onChange("job_type", value)}
							>
								<SelectTrigger
									id={id("job_type")}
									className="w-full"
									aria-label="Job type"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{jobTypeOptions.map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 sm:col-span-6">
							<Label htmlFor={id("location")}>Location</Label>
							<Input
								id={id("location")}
								required
								value={form.location}
								onChange={(event) => onChange("location", event.target.value)}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-12">
							<Label htmlFor={id("description")}>Description</Label>
							<Textarea
								id={id("description")}
								required
								rows={5}
								value={form.description_markdown}
								onChange={(event) =>
									onChange("description_markdown", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-7">
							<Label htmlFor={id("external_url")}>Apply link</Label>
							<Input
								id={id("external_url")}
								type="url"
								value={form.external_url}
								onChange={(event) =>
									onChange("external_url", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-5">
							<Label htmlFor={id("call_to_action")}>Button label</Label>
							<Input
								id={id("call_to_action")}
								value={form.call_to_action}
								onChange={(event) =>
									onChange("call_to_action", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-4">
							<Label htmlFor={id("contact_name")}>Contact name</Label>
							<Input
								id={id("contact_name")}
								required
								value={form.contact_name}
								onChange={(event) =>
									onChange("contact_name", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-4">
							<Label htmlFor={id("contact_email")}>Contact email</Label>
							<Input
								id={id("contact_email")}
								required
								type="email"
								value={form.contact_email}
								onChange={(event) =>
									onChange("contact_email", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-4">
							<Label htmlFor={id("contact_role")}>Contact role</Label>
							<Input
								id={id("contact_role")}
								value={form.contact_role}
								onChange={(event) =>
									onChange("contact_role", event.target.value)
								}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-7">
							<Label htmlFor={id("logo_url")}>Logo URL</Label>
							<Input
								id={id("logo_url")}
								type="url"
								value={form.logo_url}
								onChange={(event) => onChange("logo_url", event.target.value)}
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-1.5 md:col-span-5">
							<Label htmlFor={id("expires_at")}>Expires</Label>
							<Input
								id={id("expires_at")}
								type="date"
								value={form.expires_at}
								onChange={(event) => onChange("expires_at", event.target.value)}
							/>
						</div>
					</div>
					<DialogFooter className="mt-6">
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							<Send className="size-4" />
							{isSubmitting ? "Submitting..." : "Submit for review"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
