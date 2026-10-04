import type { User } from "@supabase/supabase-js";
import type { ReactElement } from "react";
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

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">
					Welcome to the Member Manager
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Two quick things: tell us what we may do with your data, and upload
					your CV so partners can reach you with job opportunities.
				</p>
			</header>

			{welcome.isLoading ? (
				<SkeletonRegion label="Loading" className="flex flex-col gap-6">
					<Skeleton className="h-80 w-full rounded-xl" />
					<Skeleton className="h-40 w-full rounded-xl" />
				</SkeletonRegion>
			) : welcome.needsAccountLink ? (
				<WelcomeAccountLinkAlert />
			) : (
				<>
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

			{/* Until a decision is saved, leaving counts as "Later": the login
			    redirect would otherwise bring the member straight back here. */}
			<div className="flex justify-end">
				{welcome.isDecided ? (
					<Button type="button" onClick={welcome.continueToProfile}>
						Continue to your profile
					</Button>
				) : (
					<Button type="button" variant="ghost" onClick={welcome.skipForNow}>
						Later
					</Button>
				)}
			</div>
		</div>
	);
}
