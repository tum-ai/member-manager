import type { User } from "@supabase/supabase-js";

/** Slack OIDC name hints — not the profile data key (that is `user.id`). */
export type ProfileAuthPrefill = User["user_metadata"];

export interface ProfilePageProps {
	user: User;
}

export interface NavItem {
	id: string;
	label: string;
}
