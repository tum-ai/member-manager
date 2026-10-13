import {
	type DoorPinImportMemberRef,
	type DoorPinImportRejectedRow,
	type DoorPinImportRejection,
	type DoorPinImportResult,
	type DoorPinImportRow,
	type DoorPinImportRowRef,
	doorPinSchema,
	type MemberDoorPin,
} from "@member-manager/shared";
import { z } from "zod";
import { DatabaseError } from "./errors.js";
import {
	decryptRecordSafely,
	encryptRecord,
	SENSITIVE_DOOR_PIN_FIELDS,
} from "./sensitiveData.js";
import { getSupabase } from "./supabase.js";

/**
 * Door PINs for the office key cabinet, stored encrypted in
 * `member_door_pins` (one row per member, service role only).
 *
 * PINs are never logged and only decrypted for their owner or an admin. Every
 * function that can fail to decrypt takes a logger so the failure is visible
 * without the value.
 */

const DOOR_PIN_TABLE = "member_door_pins";
// PostgREST returns at most 1,000 rows per request.
const PAGE_SIZE = 1000;

export interface DoorPinLogger {
	warn(context: Record<string, unknown>, message: string): void;
}

export interface StoredDoorPin {
	user_id: string;
	pin: string;
	updated_at: string;
}

export interface DoorPinMember {
	user_id: string;
	given_name: string;
	surname: string;
	member_status: string;
}

function decryptStoredPin(
	row: Record<string, unknown>,
	log: DoorPinLogger,
): StoredDoorPin | null {
	const userId = String(row.user_id ?? "");
	const decrypted = decryptRecordSafely(
		row,
		SENSITIVE_DOOR_PIN_FIELDS,
		({ error }) => {
			log.warn(
				{ userId, err: error.message },
				"Failed to decrypt a stored door PIN",
			);
		},
	);
	const pin = typeof decrypted.pin === "string" ? decrypted.pin : "";
	if (!userId || !pin) return null;
	return {
		user_id: userId,
		pin,
		updated_at: String(decrypted.updated_at ?? ""),
	};
}

/** The member's PIN, or `null` when none is stored (or it can't be read). */
export async function readDoorPin(
	userId: string,
	log: DoorPinLogger,
): Promise<StoredDoorPin | null> {
	const { data, error } = await getSupabase()
		.from(DOOR_PIN_TABLE)
		.select("user_id, pin, updated_at")
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new DatabaseError();
	return data ? decryptStoredPin(data as Record<string, unknown>, log) : null;
}

/** Every stored PIN, decrypted, keyed by member. Unreadable rows are left out. */
export async function readAllDoorPins(
	log: DoorPinLogger,
): Promise<Map<string, string>> {
	const pins = new Map<string, string>();
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await getSupabase()
			.from(DOOR_PIN_TABLE)
			.select("user_id, pin, updated_at")
			.order("user_id", { ascending: true })
			.range(from, from + PAGE_SIZE - 1);
		if (error) throw new DatabaseError();
		const rows = (data ?? []) as Record<string, unknown>[];
		for (const row of rows) {
			const stored = decryptStoredPin(row, log);
			if (stored) pins.set(stored.user_id, stored.pin);
		}
		if (rows.length < PAGE_SIZE) return pins;
	}
}

/** Every member row, with the fields the import and its report need. */
export async function readDoorPinMembers(): Promise<DoorPinMember[]> {
	const members: DoorPinMember[] = [];
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await getSupabase()
			.from("members")
			.select("user_id, given_name, surname, member_status")
			.order("user_id", { ascending: true })
			.range(from, from + PAGE_SIZE - 1);
		if (error) throw new DatabaseError();
		const rows = (data ?? []) as Record<string, unknown>[];
		for (const row of rows) {
			members.push({
				user_id: String(row.user_id),
				given_name: String(row.given_name ?? ""),
				surname: String(row.surname ?? ""),
				member_status: String(row.member_status ?? ""),
			});
		}
		if (rows.length < PAGE_SIZE) return members;
	}
}

/**
 * Store (insert or replace) PINs. The plaintext never leaves this function
 * unencrypted.
 */
export async function writeDoorPins(
	pins: ReadonlyArray<{ user_id: string; pin: string }>,
	updatedBy: string,
): Promise<StoredDoorPin[]> {
	if (pins.length === 0) return [];
	const now = new Date().toISOString();
	const { data, error } = await getSupabase()
		.from(DOOR_PIN_TABLE)
		.upsert(
			pins.map(({ user_id, pin }) =>
				encryptRecord(
					{ user_id, pin, updated_by: updatedBy, updated_at: now },
					SENSITIVE_DOOR_PIN_FIELDS,
				),
			),
			{ onConflict: "user_id" },
		)
		.select("user_id, updated_at");
	if (error) throw new DatabaseError();
	const updatedAt = new Map(
		((data ?? []) as Record<string, unknown>[]).map((row) => [
			String(row.user_id),
			String(row.updated_at ?? now),
		]),
	);
	return pins.map(({ user_id, pin }) => ({
		user_id,
		pin,
		updated_at: updatedAt.get(user_id) ?? now,
	}));
}

export async function deleteDoorPin(userId: string): Promise<void> {
	const { error } = await getSupabase()
		.from(DOOR_PIN_TABLE)
		.delete()
		.eq("user_id", userId);
	if (error) throw new DatabaseError();
}

/** The member who already holds `pin`, other than `userId`, if any. */
export function findPinHolder(
	pins: ReadonlyMap<string, string>,
	pin: string,
	userId: string,
): string | null {
	for (const [holder, stored] of pins) {
		if (holder !== userId && stored === pin) return holder;
	}
	return null;
}

export function toAvailableDoorPin(stored: StoredDoorPin): MemberDoorPin {
	return {
		status: "available",
		pin: stored.pin,
		updated_at: stored.updated_at,
	};
}

export function memberDisplayName(member: {
	given_name?: string;
	surname?: string;
}): string {
	return `${member.given_name ?? ""} ${member.surname ?? ""}`.trim();
}

const emailSchema = z.email();

export function normalizeImportEmail(email: string): string {
	return email.trim().toLowerCase();
}

export interface DoorPinImportPlanInput {
	rows: readonly DoorPinImportRow[];
	/** Auth user ids by normalized email (`listAuthUserIdsByEmail`). */
	userIdsByEmail: ReadonlyMap<string, string>;
	members: readonly DoorPinMember[];
	/** Currently stored PINs by member. */
	existingPins: ReadonlyMap<string, string>;
	/** Login emails by member, for the "still without a PIN" list. */
	emailsByUserId: ReadonlyMap<string, string>;
}

export interface DoorPinImportPlan {
	result: Omit<DoorPinImportResult, "dry_run">;
	/** PINs to store: new and changed rows only. */
	writes: Array<{ user_id: string; pin: string }>;
}

/**
 * Decide what importing a cabinet sheet does, without touching the database.
 *
 * A row is stored when its email belongs to a member account and its PIN is
 * valid. Rows are rejected when the sheet repeats an email or a PIN (Traka21
 * needs unique PINs, and we can't tell which copy is right) or when the PIN
 * would end up shared with a member the sheet doesn't reassign. Members not
 * in the sheet keep their PIN.
 */
export function planDoorPinImport(
	input: DoorPinImportPlanInput,
): DoorPinImportPlan {
	const memberIds = new Set(input.members.map((member) => member.user_id));
	const rejected: DoorPinImportRejectedRow[] = [];
	const unmatched: DoorPinImportRowRef[] = [];
	const reject = (
		ref: DoorPinImportRowRef,
		reason: DoorPinImportRejection,
	): void => {
		rejected.push({ ...ref, reason });
	};

	type Candidate = DoorPinImportRowRef & {
		normalizedEmail: string;
		pin: string;
	};
	const candidates: Candidate[] = [];
	for (const row of input.rows) {
		const ref: DoorPinImportRowRef = {
			row_number: row.row_number,
			email: row.email.trim(),
			name: memberDisplayName(row),
		};
		const normalizedEmail = normalizeImportEmail(row.email);
		if (!emailSchema.safeParse(normalizedEmail).success) {
			reject(ref, "invalid_email");
			continue;
		}
		const pin = doorPinSchema.safeParse(row.pin);
		if (!pin.success) {
			reject(ref, "invalid_pin");
			continue;
		}
		candidates.push({ ...ref, normalizedEmail, pin: pin.data });
	}

	const countBy = (key: (candidate: Candidate) => string) => {
		const counts = new Map<string, number>();
		for (const candidate of candidates) {
			counts.set(key(candidate), (counts.get(key(candidate)) ?? 0) + 1);
		}
		return counts;
	};
	const emailCounts = countBy((candidate) => candidate.normalizedEmail);
	const pinCounts = countBy((candidate) => candidate.pin);

	// Accepted rows by member. A member appears once: a repeated email is
	// rejected above, and one email maps to one account.
	const accepted = new Map<string, Candidate>();
	for (const candidate of candidates) {
		if ((emailCounts.get(candidate.normalizedEmail) ?? 0) > 1) {
			reject(candidate, "duplicate_email");
			continue;
		}
		if ((pinCounts.get(candidate.pin) ?? 0) > 1) {
			reject(candidate, "duplicate_pin");
			continue;
		}
		const userId = input.userIdsByEmail.get(candidate.normalizedEmail);
		if (!userId || !memberIds.has(userId)) {
			unmatched.push(toRowRef(candidate));
			continue;
		}
		accepted.set(userId, candidate);
	}

	// A PIN may only end up with one member. Applying the sheet can't give a
	// member a PIN someone outside it still holds; rejecting such a row keeps
	// that member's old PIN, which can in turn clash with another row, so
	// repeat until nothing changes. Swaps within the sheet are fine.
	while (true) {
		const finalPins = new Map(input.existingPins);
		for (const [userId, candidate] of accepted) {
			finalPins.set(userId, candidate.pin);
		}
		const holders = new Map<string, number>();
		for (const pin of finalPins.values()) {
			holders.set(pin, (holders.get(pin) ?? 0) + 1);
		}
		const clashing = [...accepted].filter(
			([, candidate]) => (holders.get(candidate.pin) ?? 0) > 1,
		);
		if (clashing.length === 0) break;
		for (const [userId, candidate] of clashing) {
			accepted.delete(userId);
			reject(candidate, "pin_in_use");
		}
	}

	let created = 0;
	let updated = 0;
	let unchanged = 0;
	const writes: Array<{ user_id: string; pin: string }> = [];
	for (const [userId, candidate] of accepted) {
		const existing = input.existingPins.get(userId);
		if (existing === candidate.pin) {
			unchanged += 1;
			continue;
		}
		if (existing === undefined) created += 1;
		else updated += 1;
		writes.push({ user_id: userId, pin: candidate.pin });
	}

	const membersWithoutPin: DoorPinImportMemberRef[] = input.members
		.filter(
			(member) =>
				member.member_status === "active" &&
				!accepted.has(member.user_id) &&
				!input.existingPins.has(member.user_id),
		)
		.map((member) => ({
			user_id: member.user_id,
			name: memberDisplayName(member),
			email: input.emailsByUserId.get(member.user_id) ?? "",
		}))
		.sort(
			(a, b) =>
				(a.name || a.email).localeCompare(b.name || b.email) ||
				a.user_id.localeCompare(b.user_id),
		);

	const byRow = (a: DoorPinImportRowRef, b: DoorPinImportRowRef) =>
		a.row_number - b.row_number;
	return {
		result: {
			total: input.rows.length,
			matched: accepted.size,
			created,
			updated,
			unchanged,
			unmatched: unmatched.sort(byRow),
			rejected: rejected
				.map((row) => ({ ...toRowRef(row), reason: row.reason }))
				.sort(byRow),
			members_without_pin: membersWithoutPin,
		},
		writes,
	};
}

// Strip planner-only fields (normalized email, PIN) before anything is
// returned to the client.
function toRowRef(row: DoorPinImportRowRef): DoorPinImportRowRef {
	return { row_number: row.row_number, email: row.email, name: row.name };
}
