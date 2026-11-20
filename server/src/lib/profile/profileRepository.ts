import { DatabaseError } from "../errors.js";
import { getSupabase } from "../supabase.js";

type Row = Record<string, unknown>;

/** The stored profile rows of one member, still encrypted. */
export interface StoredProfile {
	member: Row | null;
	sepa: Row | null;
	agreements: Row | null;
}

export interface SaveProfileArgs {
	userId: string;
	expectedVersion: number;
	/** Partial member columns; sensitive ones already encrypted. */
	member: Record<string, unknown>;
	/** Encrypted bank details, or null to leave the sepa row untouched. */
	sepa: Record<string, unknown> | null;
	/** Agreement columns, or null to leave the agreements row untouched. */
	agreements: Record<string, unknown> | null;
}

/** SQLSTATE `save_member_profile` raises for a stale expected version. */
const VERSION_CONFLICT_SQLSTATE = "40001";

/** Thrown when the stored profile moved on since the caller read it. */
export class ProfileVersionConflictError extends Error {
	constructor() {
		super("Profile version conflict");
		this.name = "ProfileVersionConflictError";
	}
}

/**
 * The only module that talks to Supabase for the profile. Rows come back as
 * stored (ciphertext for sensitive columns); decrypting is the caller's job so
 * it stays explicit where plaintext exists.
 */
export async function loadStoredProfile(
	userId: string,
): Promise<StoredProfile> {
	const supabase = getSupabase();
	const [member, sepa, agreements] = await Promise.all([
		supabase.from("members").select("*").eq("user_id", userId).maybeSingle(),
		supabase.from("sepa").select("*").eq("user_id", userId).maybeSingle(),
		supabase
			.from("member_agreements")
			.select("*")
			.eq("user_id", userId)
			.maybeSingle(),
	]);

	for (const { error } of [member, sepa, agreements]) {
		if (error) {
			throw new DatabaseError();
		}
	}

	return {
		member: (member.data as Row | null) ?? null,
		sepa: (sepa.data as Row | null) ?? null,
		agreements: (agreements.data as Row | null) ?? null,
	};
}

/**
 * Writes member, bank details and agreements in one transaction. Resolves with
 * the new profile version; throws {@link ProfileVersionConflictError} when
 * `expectedVersion` is stale.
 */
export async function saveStoredProfile(
	args: SaveProfileArgs,
): Promise<number> {
	const { data, error } = await getSupabase().rpc("save_member_profile", {
		p_user_id: args.userId,
		p_expected_version: args.expectedVersion,
		p_member: args.member,
		p_sepa: args.sepa,
		p_agreements: args.agreements,
	});

	if (error) {
		if ((error as { code?: string }).code === VERSION_CONFLICT_SQLSTATE) {
			throw new ProfileVersionConflictError();
		}
		throw error;
	}

	return Number(data);
}
