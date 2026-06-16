import { CONTRACT_ADDONS, CONTRACT_PACKAGES } from "@member-manager/shared";
import {
	AlignLeft,
	Building2,
	Calendar,
	CircleCheck,
	Copy,
	ExternalLink,
	Hash,
	Info,
	type LucideIcon,
	Mail,
	MapPin,
	Package,
	TriangleAlert,
	User,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/ToastContext";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { useCurrentUserIsAdmin } from "@/hooks/useCurrentUserIsAdmin";
import { cn } from "@/lib/utils";
import { useToolAccess } from "@/hooks/useToolAccess";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import {
	getContractStatusLabel,
	getContractStatusTone,
} from "./contractStatus";
import { SignaturePad } from "./SignaturePad";
import {
	downloadContractSubmissionPdf,
	useBoardSignContractSubmission,
	useContractSubmission,
	useContractSubmissionComments,
	useContractSubmissionPreview,
	useCreateContractSubmissionComment,
	useFinalizeContractSubmission,
	useUpdateContractSubmission,
} from "./useContracts";

function humanizeKey(key: string): string {
	return key
		.replace(/_/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase())
		.replace(/\bTumai\b/g, "TUM.ai")
		.replace(/\bIban\b/g, "IBAN")
		.replace(/\bUrl\b/g, "URL")
		.replace(/\bId\b/g, "ID");
}

function fieldIcon(key: string): LucideIcon {
	const k = key.toLowerCase();
	if (k.includes("date")) return Calendar;
	if (k.includes("email")) return Mail;
	if (k.includes("package") || k.includes("addon")) return Package;
	if (k.includes("address")) return MapPin;
	if (k.includes("company")) return Building2;
	if (k.includes("description") || k.includes("terms") || k.includes("notes"))
		return AlignLeft;
	if (
		k.includes("name") ||
		k.includes("signer") ||
		k.includes("representative") ||
		k.includes("contact")
	)
		return User;
	if (k.includes("amount") || k.includes("number") || k.includes("count"))
		return Hash;
	return Info;
}

function mapOptionLabel(option: string): string {
	return (
		CONTRACT_PACKAGES[option]?.label ?? CONTRACT_ADDONS[option]?.label ?? option
	);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatIsoDate(value: string): string {
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function renderFieldValue(key: string, value: unknown): React.ReactNode {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	const k = key.toLowerCase();
	if (Array.isArray(value)) {
		return value.length > 0
			? value.map((entry) => mapOptionLabel(String(entry))).join(", ")
			: "—";
	}
	if (typeof value === "object") return JSON.stringify(value);
	const str = String(value);
	if (k.includes("email")) {
		return (
			<LinkButton asChild>
				<a href={`mailto:${str}`}>{str}</a>
			</LinkButton>
		);
	}
	if (k.includes("date") && ISO_DATE.test(str)) return formatIsoDate(str);
	if (k.includes("package") || k.includes("addon")) return mapOptionLabel(str);
	return str;
}

function CopyButton({ value }: { value: string }): JSX.Element {
	const { showToast } = useToast();
	return (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="Copy to clipboard"
			onClick={() => {
				navigator.clipboard
					.writeText(value)
					.then(() => showToast("Copied to clipboard", "success"))
					.catch(() => showToast("Could not copy", "error"));
			}}
		>
			<Copy className="size-4" />
		</Button>
	);
}

type ActivityTone = "success" | "error" | "info";

function ActivityRow({
	tone,
	children,
}: {
	tone: ActivityTone;
	children: React.ReactNode;
}): JSX.Element {
	const Icon = tone === "error" ? TriangleAlert : CircleCheck;
	return (
		<div className="flex items-start gap-2 text-sm">
			<Icon
				className={cn(
					"mt-0.5 size-4 shrink-0",
					tone === "error" ? "text-destructive" : "text-emerald-600",
				)}
			/>
			<span className="text-muted-foreground">{children}</span>
		</div>
	);
}

export default function ContractSubmissionDetailPage(): JSX.Element {
	const { id } = useParams<{ id: string }>();
	const submissionQuery = useContractSubmission(id);
	const updateMutation = useUpdateContractSubmission(id ?? "");
	const boardSignMutation = useBoardSignContractSubmission(id ?? "");
	const finalizeMutation = useFinalizeContractSubmission(id ?? "");
	const commentsQuery = useContractSubmissionComments(id);
	const createCommentMutation = useCreateContractSubmissionComment(id ?? "");

	const [editedText, setEditedText] = useState("");
	const [notes, setNotes] = useState("");
	const [clarificationMessage, setClarificationMessage] = useState("");
	const [internalComment, setInternalComment] = useState("");
	const [boardSignatureData, setBoardSignatureData] = useState<string | null>(
		null,
	);
	const [boardSignerName, setBoardSignerName] = useState("");
	const [partnerEmailSubject, setPartnerEmailSubject] = useState("");
	const [partnerEmailMessage, setPartnerEmailMessage] = useState("");
	const [downloadError, setDownloadError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const { currentUserId, isAdmin } = useCurrentUserIsAdmin();
	const { permissions } = useToolAccess();
	const isContractsAdmin = isAdmin || permissions.includes("contracts.admin");
	const previewQuery = useContractSubmissionPreview(
		isContractsAdmin ? id : undefined,
		editedText,
	);

	useEffect(() => {
		const data = submissionQuery.data;
		if (data) {
			setEditedText(
				data.admin_edited_text ?? data.generated_contract_text ?? "",
			);
			setNotes(data.notes ?? "");
			setClarificationMessage(data.feedback_message ?? "");
			const partnerCompany =
				typeof data.form_data.partner_company_name === "string"
					? data.form_data.partner_company_name
					: "your team";
			setPartnerEmailSubject(`TUM.ai contract for ${partnerCompany}`);
			setPartnerEmailMessage(
				"Please review and sign the contract using the secure link below.",
			);
		}
	}, [submissionQuery.data]);

	if (submissionQuery.isLoading) return <ContractSubmissionDetailSkeleton />;
	if (submissionQuery.error)
		return (
			<Alert variant="destructive">
				<AlertDescription>
					{(submissionQuery.error as Error).message}
				</AlertDescription>
			</Alert>
		);
	const submission = submissionQuery.data;
	if (!submission)
		return (
			<Alert>
				<AlertDescription>Not found</AlertDescription>
			</Alert>
		);

	const signUrl = submission.signature_token
		? `${window.location.origin}/contracts/sign/${submission.signature_token}`
		: null;
	const finalPdfUrl = submission.final_pdf_token
		? `${window.location.origin}/api/contracts/final/${submission.final_pdf_token}/pdf`
		: null;
	const busy =
		updateMutation.isPending ||
		boardSignMutation.isPending ||
		finalizeMutation.isPending ||
		createCommentMutation.isPending;
	const actionError =
		updateMutation.error ??
		boardSignMutation.error ??
		finalizeMutation.error ??
		createCommentMutation.error;
	const comments = commentsQuery.data ?? [];
	const hasLegacyComment = submission.partner_comment && comments.length === 0;
	const canEditDraft =
		submission.status === "draft" &&
		(submission.submitter_user_id === currentUserId || isAdmin);
	const formEntries = Object.entries(submission.form_data ?? {});

	return (
		<ToolPageShell
			title={`Submission ${submission.id.slice(0, 8)}…`}
			description="Review, edit and progress this contract through the workflow."
		>
			<div className="mb-6 flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Status</span>
				<Badge variant={getContractStatusTone(submission.status)}>
					{getContractStatusLabel(submission.status)}
				</Badge>
			</div>

			<div className="flex flex-col gap-6">
				<GlassCard className="p-6">
					<p className="mb-3 text-base font-medium">Form data</p>
					{formEntries.length > 0 ? (
						<dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
							{formEntries.map(([key, value]) => {
								const Icon = fieldIcon(key);
								return (
									<div key={key} className="flex items-start gap-3">
										<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
										<div className="min-w-0">
											<dt className="text-xs text-muted-foreground">
												{humanizeKey(key)}
											</dt>
											<dd className="break-words text-sm">
												{renderFieldValue(key, value)}
											</dd>
										</div>
									</div>
								);
							})}
						</dl>
					) : (
						<p className="text-sm text-muted-foreground">No form data.</p>
					)}
					<Collapsible className="mt-4">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm">
								Show raw JSON
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[13px]">
								{JSON.stringify(submission.form_data, null, 2)}
							</pre>
						</CollapsibleContent>
					</Collapsible>
				</GlassCard>

				<GlassCard className="p-6">
					<Tabs defaultValue="edit">
						<div className="mb-3 flex items-center justify-between gap-3">
							<p className="text-base font-medium">Contract text</p>
							<TabsList>
								<TabsTrigger value="edit">Edit</TabsTrigger>
								<TabsTrigger value="preview">Preview</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent value="edit">
							<Textarea
								rows={10}
								className="max-h-[60vh] min-h-40 font-mono"
								value={editedText}
								onChange={(event) => setEditedText(event.target.value)}
							/>
						</TabsContent>
						<TabsContent value="preview">
							<div className="overflow-hidden rounded-md border">
								<ContractDocumentPreview
									pages={previewQuery.data?.pages}
									loading={previewQuery.isLoading || previewQuery.isFetching}
									maxHeight={{ xs: "60vh", lg: "70vh" }}
									minHeight={360}
									pageMaxWidth={640}
								/>
							</div>
						</TabsContent>
					</Tabs>
					<div className="mt-4 flex flex-col gap-1.5">
						<Label htmlFor="internal-notes">Internal notes</Label>
						<Textarea
							id="internal-notes"
							rows={2}
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
						/>
					</div>
				</GlassCard>

				<GlassCard className="p-6">
					<p className="mb-4 text-base font-medium">Actions</p>

					{actionError ? (
						<Alert variant="destructive" className="mb-4">
							<AlertDescription>
								{actionError instanceof Error
									? actionError.message
									: "Action failed"}
							</AlertDescription>
						</Alert>
					) : null}
					{downloadError ? (
						<Alert variant="destructive" className="mb-4">
							<AlertDescription>{downloadError}</AlertDescription>
						</Alert>
					) : null}

					{/* Document actions */}
					<div className="flex flex-row flex-wrap gap-2">
						{canEditDraft ? (
							<Button variant="outline" asChild>
								<RouterLink to={`/contracts/drafts/${submission.id}`}>
									Edit draft
								</RouterLink>
							</Button>
						) : null}
						<Button
							disabled={busy}
							onClick={() =>
								updateMutation.mutate({
									admin_edited_text: editedText,
									notes,
								})
							}
						>
							Save changes
						</Button>
						<Button
							variant="outline"
							disabled={busy || downloading}
							onClick={async () => {
								if (!id) return;
								setDownloadError(null);
								setDownloading(true);
								try {
									await downloadContractSubmissionPdf(id);
								} catch (error) {
									setDownloadError(
										error instanceof Error ? error.message : "Download failed",
									);
								} finally {
									setDownloading(false);
								}
							}}
						>
							{downloading ? "Downloading..." : "Download PDF"}
						</Button>
					</div>

					<Separator className="my-5" />

					{/* Send to partner */}
					<p className="mb-3 text-sm font-medium">Send to partner</p>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="partner-email-subject">Email subject</Label>
							<Input
								id="partner-email-subject"
								value={partnerEmailSubject}
								onChange={(event) => setPartnerEmailSubject(event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="partner-email-message">Email message</Label>
							<Textarea
								id="partner-email-message"
								value={partnerEmailMessage}
								onChange={(event) => setPartnerEmailMessage(event.target.value)}
								rows={2}
							/>
						</div>
						<div className="flex flex-row flex-wrap gap-2">
							<Button
								disabled={busy}
								onClick={() =>
									updateMutation.mutate({
										admin_edited_text: editedText,
										notes,
										send_to_partner: true,
									})
								}
							>
								Send to partner
							</Button>
							<Button
								disabled={busy}
								onClick={() =>
									updateMutation.mutate({
										admin_edited_text: editedText,
										notes,
										send_partner_email: true,
										partner_email_subject: partnerEmailSubject,
										partner_email_message: partnerEmailMessage,
									})
								}
							>
								Send email to partner
							</Button>
							<Button
								disabled={busy}
								onClick={() =>
									updateMutation.mutate({
										admin_edited_text: editedText,
										notes,
										send_opensign: true,
									})
								}
							>
								Send with OpenSign
							</Button>
						</div>
						{signUrl ? (
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="sign-url">Signing link (send to partner)</Label>
								<div className="flex items-center gap-1">
									<Input id="sign-url" value={signUrl} readOnly />
									<CopyButton value={signUrl} />
								</div>
							</div>
						) : null}
					</div>

					<Separator className="my-5" />

					{/* Decision */}
					<p className="mb-3 text-sm font-medium">Decision</p>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="clarification-message">
								Clarification message
							</Label>
							<Textarea
								id="clarification-message"
								value={clarificationMessage}
								onChange={(event) =>
									setClarificationMessage(event.target.value)
								}
								rows={2}
							/>
						</div>
						<div className="flex flex-row flex-wrap gap-2">
							<Button
								variant="outline"
								className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
								disabled={busy}
								onClick={() =>
									updateMutation.mutate({
										status: "inquiry",
										notes,
										feedback_message: clarificationMessage.trim() || null,
									})
								}
							>
								Request clarification
							</Button>
							<Button
								variant="outline"
								className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
								disabled={busy}
								onClick={() =>
									updateMutation.mutate({
										status: "rejected",
										notes,
									})
								}
							>
								Reject
							</Button>
						</div>
					</div>

					{/* Activity */}
					{submission.partner_email_sent_at ||
					submission.partner_email_error ||
					submission.clarification_email_sent_at ||
					submission.clarification_email_error ||
					submission.opensign_sent_at ||
					submission.opensign_completed_at ||
					submission.opensign_error ? (
						<>
							<Separator className="my-5" />
							<p className="mb-3 text-sm font-medium">Activity</p>
							<div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
								{submission.partner_email_sent_at ? (
									<ActivityRow tone="success">
										Email sent to {submission.partner_email_recipient} at{" "}
										{new Date(
											submission.partner_email_sent_at,
										).toLocaleString()}
									</ActivityRow>
								) : null}
								{submission.partner_email_error ? (
									<ActivityRow tone="error">
										Last email error: {submission.partner_email_error}
									</ActivityRow>
								) : null}
								{submission.clarification_email_sent_at ? (
									<ActivityRow tone="success">
										Clarification email sent to{" "}
										{submission.clarification_email_recipient} at{" "}
										{new Date(
											submission.clarification_email_sent_at,
										).toLocaleString()}
									</ActivityRow>
								) : null}
								{submission.clarification_email_error ? (
									<ActivityRow tone="error">
										Clarification email error:{" "}
										{submission.clarification_email_error}
									</ActivityRow>
								) : null}
								{submission.opensign_sent_at ? (
									<ActivityRow tone="success">
										OpenSign document {submission.opensign_document_id} sent at{" "}
										{new Date(submission.opensign_sent_at).toLocaleString()}
										{submission.opensign_status
											? ` (${submission.opensign_status})`
											: ""}
									</ActivityRow>
								) : null}
								{submission.opensign_completed_at ? (
									<ActivityRow tone="success">
										OpenSign completed at{" "}
										{new Date(
											submission.opensign_completed_at,
										).toLocaleString()}
									</ActivityRow>
								) : null}
								{submission.opensign_error ? (
									<ActivityRow tone="error">
										Last OpenSign error: {submission.opensign_error}
									</ActivityRow>
								) : null}
							</div>
						</>
					) : null}

					{finalPdfUrl ? (
						<>
							<Separator className="my-5" />
							<p className="mb-3 text-sm font-medium">Final PDF</p>
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center gap-1">
									<Input value={finalPdfUrl} readOnly />
									<CopyButton value={finalPdfUrl} />
								</div>
								<div className="mt-1 flex flex-row gap-2">
									<Button variant="ghost" asChild>
										<a href={finalPdfUrl} target="_blank" rel="noreferrer">
											<ExternalLink className="size-4" />
											Open final PDF
										</a>
									</Button>
									<Button variant="outline" asChild>
										<a
											href={`${finalPdfUrl}?download=1`}
											target="_blank"
											rel="noreferrer"
										>
											Download final PDF
										</a>
									</Button>
								</div>
							</div>
						</>
					) : null}
				</GlassCard>

				<GlassCard className="p-6">
					<p className="mb-2 text-base font-medium">Comment history</p>
					{commentsQuery.isLoading ? (
						<SkeletonRegion
							label="Loading comments"
							className="flex flex-col gap-4"
						>
							{Array.from({ length: 2 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								<div key={i} className="space-y-1.5">
									<Skeleton className="h-3 w-40" />
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-2/3" />
								</div>
							))}
						</SkeletonRegion>
					) : commentsQuery.error ? (
						<Alert variant="destructive">
							<AlertDescription>
								{(commentsQuery.error as Error).message}
							</AlertDescription>
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
									onChange={(event) => setInternalComment(event.target.value)}
									rows={3}
								/>
							</div>
							<div>
								<Button
									variant="outline"
									disabled={!internalComment.trim() || busy}
									onClick={() =>
										createCommentMutation.mutate(
											{ comment: internalComment.trim() },
											{ onSuccess: () => setInternalComment("") },
										)
									}
								>
									Add internal reply
								</Button>
							</div>
						</div>
					) : null}
				</GlassCard>

				{isContractsAdmin && submission.status === "partner_signed" ? (
					<GlassCard className="p-6">
						<p className="mb-2 text-base font-medium">Board signature</p>
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="board-signer-name">Board signer name</Label>
								<Input
									id="board-signer-name"
									value={boardSignerName}
									onChange={(event) => setBoardSignerName(event.target.value)}
									required
								/>
							</div>
							<SignaturePad onChange={setBoardSignatureData} />
							<Button
								className="self-start"
								disabled={
									!boardSignatureData || !boardSignerName.trim() || busy
								}
								onClick={() =>
									boardSignMutation.mutate({
										signature_data: boardSignatureData ?? "",
										signer_name: boardSignerName.trim(),
									})
								}
							>
								Board sign
							</Button>
						</div>
					</GlassCard>
				) : null}

				{isContractsAdmin && submission.status === "board_signed" ? (
					<GlassCard className="p-6">
						<p className="mb-2 text-base font-medium">Final PDF</p>
						<Button
							className="self-start"
							disabled={busy}
							onClick={() => finalizeMutation.mutate()}
						>
							Generate final PDF link
						</Button>
					</GlassCard>
				) : null}
			</div>
		</ToolPageShell>
	);
}

function ContractSubmissionDetailSkeleton() {
	return (
		<ToolPageShell
			title="Submission"
			description="Review, edit and progress this contract through the workflow."
		>
			<SkeletonRegion label="Loading submission">
				<div className="mb-6 flex items-center gap-2">
					<Skeleton className="h-4 w-12" />
					<Skeleton className="h-5 w-24 rounded-full" />
				</div>

				<div className="flex flex-col gap-6">
					<GlassCard className="p-6">
						<Skeleton className="mb-3 h-5 w-24" />
						<dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
							{Array.from({ length: 6 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								<div key={i} className="flex items-start gap-3">
									<Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
									<div className="min-w-0 flex-1 space-y-1.5">
										<Skeleton className="h-3 w-24" />
										<Skeleton className="h-4 w-3/4" />
									</div>
								</div>
							))}
						</dl>
					</GlassCard>

					<GlassCard className="p-6">
						<Skeleton className="mb-3 h-5 w-32" />
						<Skeleton className="mx-auto aspect-[1/1.414] w-full max-w-[595px] rounded-md" />
					</GlassCard>
				</div>
			</SkeletonRegion>
		</ToolPageShell>
	);
}
