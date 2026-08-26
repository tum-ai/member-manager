import type { User } from "@supabase/supabase-js";
import "./beacon.css";
import { ExpertiseProfileHeaderOwner } from "./components/ExpertiseProfileHeaderOwner";
import { ExpertiseProfileSection } from "./components/ExpertiseProfileSection";
import { useExpertiseProfilePage } from "./hooks/useExpertiseProfilePage";

interface ExpertiseProfilePageProps {
	user: User;
	userId?: string;
}

/** Route component for standalone and embedded Beacon expertise profiles. */
export default function ExpertiseProfilePage(
	props: ExpertiseProfilePageProps,
): JSX.Element {
	const profilePage = useExpertiseProfilePage(props);
	return (
		<>
			{profilePage.embedded ? null : <ExpertiseProfileHeaderOwner />}
			<ExpertiseProfileSection profilePage={profilePage} />
		</>
	);
}
