import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface Props {
	engagementCount: number;
	isSubmitting: boolean;
	isRequestPending: boolean;
	isGenerating: boolean;
	showDownload: boolean;
	onAddEngagement: () => void;
	onDownloadApproved: () => void;
}

export function EngagementFormActions({
	engagementCount,
	isSubmitting,
	isRequestPending,
	isGenerating,
	showDownload,
	onAddEngagement,
	onDownloadApproved,
}: Props): JSX.Element {
	return (
		<>
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
				<Button
					type="button"
					variant="outline"
					className="w-full sm:w-auto"
					onClick={onAddEngagement}
					disabled={engagementCount >= 5}
				>
					<Plus className="size-4" />
					Add Another Engagement
				</Button>

				<div className="hidden flex-1 sm:block" />

				<Button
					type="submit"
					size="lg"
					className="w-full sm:w-auto"
					disabled={isSubmitting || isRequestPending}
				>
					{isSubmitting ? (
						<Spinner className="size-5" />
					) : (
						<Download className="size-4" />
					)}
					{isSubmitting
						? "Submitting..."
						: isRequestPending
							? "Awaiting Admin Review"
							: "Submit for Approval"}
				</Button>
			</div>

			{showDownload && (
				<div className="mb-6 flex justify-end">
					<Button
						type="button"
						variant="outline"
						className="w-full sm:w-auto"
						onClick={onDownloadApproved}
						disabled={isGenerating}
					>
						{isGenerating ? (
							<Spinner className="size-[18px]" />
						) : (
							<Download className="size-4" />
						)}
						{isGenerating
							? "Generating approved certificate..."
							: "Download Approved Certificate"}
					</Button>
				</div>
			)}

			<p className="mt-2 text-xs text-muted-foreground">
				* Dates, weekly hours, department, and responsibilities are required.
				Special role is optional.
			</p>
		</>
	);
}
