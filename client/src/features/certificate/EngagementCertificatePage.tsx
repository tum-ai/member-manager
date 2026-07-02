import type { User } from "@supabase/supabase-js";

import { ToolPageShell } from "@/features/tools/ToolPageShell";

import { EngagementCard } from "./components/EngagementCard";
import { EngagementCertificateSkeleton } from "./components/EngagementCertificateSkeleton";
import { EngagementFormActions } from "./components/EngagementFormActions";
import { EngagementInfoCard } from "./components/EngagementInfoCard";
import { useEngagementCertificateForm } from "./hooks/useEngagementCertificateForm";

interface Props {
	user: User;
}

export default function EngagementCertificatePage({
	user,
}: Props): JSX.Element {
	const {
		member,
		isLoading,
		fetchError,
		form,
		fields,
		isSubmitting,
		isGenerating,
		latestRequest,
		approvedRequest,
		isRequestPending,
		birthDate,
		handleSubmitForApproval,
		handleDownloadApproved,
		handleAddEngagement,
		handleRemoveEngagement,
	} = useEngagementCertificateForm(user.id);

	if (isLoading) {
		return <EngagementCertificateSkeleton />;
	}

	if (fetchError) {
		return (
			<div className="p-6">
				<p className="text-destructive">
					Error loading member data: {fetchError.message}
				</p>
			</div>
		);
	}

	if (!member) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">No member data found.</p>
			</div>
		);
	}

	return (
		<ToolPageShell
			title="Engagement Certificate"
			description="Submit engagement details for admin review."
		>
			<EngagementInfoCard
				salutation={member.salutation}
				givenName={member.given_name}
				surname={member.surname}
				birthDate={birthDate}
				latestRequest={latestRequest}
			/>

			<form onSubmit={form.handleSubmit(handleSubmitForApproval)}>
				{fields.map((field, index) => (
					<EngagementCard
						key={field.id}
						form={form}
						index={index}
						canRemove={fields.length > 1}
						onRemove={handleRemoveEngagement}
					/>
				))}

				<EngagementFormActions
					engagementCount={fields.length}
					isSubmitting={isSubmitting}
					isRequestPending={isRequestPending}
					isGenerating={isGenerating}
					showDownload={!!approvedRequest}
					onAddEngagement={handleAddEngagement}
					onDownloadApproved={handleDownloadApproved}
				/>
			</form>
		</ToolPageShell>
	);
}
