import type { User } from "@supabase/supabase-js";
import "./beacon.css";
import { ExpertiseChatSection } from "./components/ExpertiseChatSection";
import { useExpertiseChatPage } from "./hooks/useExpertiseChatPage";

/** Route component for the Beacon conversational assistant. */
export default function ExpertiseChatPage({
	user,
}: {
	user: User;
}): JSX.Element {
	const chat = useExpertiseChatPage(user);
	return <ExpertiseChatSection chat={chat} />;
}
