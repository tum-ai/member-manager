import type { User } from "@supabase/supabase-js";

export interface Member {
	active: boolean;
	salutation: string;
	title: string;
	surname: string;
	given_name: string;
	email: string;
	date_of_birth: string;
	street: string;
	number: string;
	postal_code: string;
	city: string;
	country: string;
	user_id: string;
	batch?: string | null;
	department?: string | null;
	member_role?: string | null;
	degree?: string | null;
	school?: string | null;
	skills?: string[] | null;
	profile_picture_url?: string | null;
	// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
	[key: string]: any;
}

export interface Sepa {
	iban: string;
	bic: string;
	bank_name: string;
	mandate_agreed: boolean;
	privacy_agreed: boolean;
	user_id: string;
	// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
	[key: string]: any;
}

export interface SepaUpdateEventDetail {
	mandate_agreed: boolean;
}

export interface PrivacyUpdateEventDetail {
	privacy_agreed: boolean;
}

// Re-export User so we don't have to import from supabase-js everywhere if we don't want to
export type { User };
