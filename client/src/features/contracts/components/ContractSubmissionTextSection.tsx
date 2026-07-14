import type { ContractSubmission } from "@member-manager/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ContractDocumentPreview } from "@/features/contracts/ContractDocumentPreview";

export function ContractSubmissionTextSection({
	submission,
	isContractsAdmin,
	editedText,
	notes,
	previewPages,
	previewLoading,
	onEditedTextChange,
	onNotesChange,
}: {
	submission: ContractSubmission;
	isContractsAdmin: boolean;
	editedText: string;
	notes: string;
	previewPages: string[] | undefined;
	previewLoading: boolean;
	onEditedTextChange: (value: string) => void;
	onNotesChange: (value: string) => void;
}): JSX.Element {
	return (
		<GlassCard className="p-6">
			<p className="mb-3 text-base font-medium">Contract text</p>
			{isContractsAdmin ? (
				<>
					<Tabs defaultValue="edit">
						<div className="mb-3 flex items-center justify-between gap-3">
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
								onChange={(event) => onEditedTextChange(event.target.value)}
							/>
						</TabsContent>
						<TabsContent value="preview">
							<div className="overflow-hidden rounded-md border">
								<ContractDocumentPreview
									pages={previewPages}
									loading={previewLoading}
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
							onChange={(event) => onNotesChange(event.target.value)}
						/>
					</div>
				</>
			) : (
				<>
					{submission.status === "inquiry" && submission.feedback_message ? (
						<Alert className="mb-4">
							<AlertDescription>
								<strong>Feedback from L&amp;F:</strong>{" "}
								{submission.feedback_message}
							</AlertDescription>
						</Alert>
					) : null}
					<pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm leading-relaxed">
						{submission.admin_edited_text ??
							submission.generated_contract_text ??
							"No contract text available."}
					</pre>
				</>
			)}
		</GlassCard>
	);
}
