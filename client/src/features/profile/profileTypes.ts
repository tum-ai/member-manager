import type { User } from "@supabase/supabase-js";

export interface ProfilePageProps {
	user: User;
}

export interface NavItem {
	id: string;
	label: string;
}
