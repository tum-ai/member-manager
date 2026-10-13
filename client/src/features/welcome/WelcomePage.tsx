import type { User } from "@supabase/supabase-js";
import { type ReactElement, useId } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { CvPanel } from "@/features/profile/CvPanel";
import { WelcomeAccountLinkAlert } from "@/features/welcome/components/WelcomeAccountLinkAlert";
import { WelcomeConsentSection } from "@/features/welcome/components/WelcomeConsentSection";
import { useWelcome } from "@/features/welcome/hooks/useWelcome";

interface WelcomePageProps {
	user: User;
}

export default function WelcomePage({ user }: WelcomePageProps): ReactElement {
	const welcome = useWelcome(user.id);
	const missingHintId = useId();
	const missing = [
		welcome.needsConsentDecision && "save your consent choices",
		welcome.needsCv && "upload your CV",
	].filter(Boolean);
	const showMissingHint = !welcome.canContinue && missing.length > 0;

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">
					Welcome to the Member Manager
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Two quick things before you continue: tell us what we may do with your
					data, and upload your CV so partners can reach you with job
					opportunities.
				</p>
			</header>

			{welcome.isLoading ? (
				<SkeletonRegion label="Loading" className="flex flex-col gap-6">
					<Skeleton className="h-80 w-full rounded-xl" />
					<Skeleton className="h-40 w-full rounded-xl" />
				</SkeletonRegion>
			) : (
				<>
					{welcome.needsAccountLink && <WelcomeAccountLinkAlert />}
					<WelcomeConsentSection
						draft={welcome.draft}
						onConsentChange={welcome.setConsent}
						onAgreeToAll={welcome.agreeToAll}
						onSave={welcome.saveConsents}
						isSaving={welcome.isSaving}
						isDirty={welcome.isDirty}
						isDecided={welcome.isDecided}
					/>
					<CvPanel userId={user.id} id="cv" />
				</>
			)}

			{/* No "Later": WelcomeRedirect keeps an unfinished member here. */}
			<div className="flex flex-col items-stretch gap-2 sm:items-end">
				<Button
					type="button"
					onClick={welcome.continueToApp}
					disabled={!welcome.canContinue}
					aria-describedby={showMissingHint ? missingHintId : undefined}
				>
					Continue
				</Button>
				{showMissingHint && (
					<p id={missingHintId} className="text-xs text-muted-foreground">
						To continue, {missing.join(" and ")}.
					</p>
				)}
			</div>
		</div>
	);
}
