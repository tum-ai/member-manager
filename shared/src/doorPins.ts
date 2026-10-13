import { z } from "zod";

/**
 * Door PINs open the TUM.ai office key cabinet (Traka21). Each member has at
 * most one, stored encrypted in `member_door_pins`; the cabinet itself is the
 * source of truth and admins mirror its user sheet into the portal.
 *
 * Traka21 accepts 4–10 characters and requires every PIN to be unique. The
 * cabinet is operated by keypad, so the portal only accepts digits.
 */
export const DOOR_PIN_PATTERN = /^[0-9]{4,10}$/;

export const DOOR_PIN_MESSAGE = "A door PIN has 4 to 10 digits";

export const doorPinSchema = z
	.string()
	.trim()
	.regex(DOOR_PIN_PATTERN, { message: DOOR_PIN_MESSAGE });

/** Body of `PUT /api/admin/members/:userId/door-pin`. */
export const setDoorPinSchema = z.object({ pin: doorPinSchema });

export type SetDoorPinInput = z.infer<typeof setDoorPinSchema>;

/**
 * Response of `GET /api/members/:userId/door-pin` (and of the admin `PUT`).
 *
 * - `available`: the PIN, in plaintext, for its owner or an admin.
 * - `not_assigned`: the member has no PIN in the portal.
 * - `welcome_required`: the member asked for their own PIN before saving a
 *   decision on /welcome. The PIN is only handed out once they have.
 */
export type MemberDoorPin =
	| { status: "available"; pin: string; updated_at: string }
	| { status: "not_assigned" }
	| { status: "welcome_required" };

/** Traka21 holds at most 1,000 user records, so one sheet never has more. */
export const DOOR_PIN_IMPORT_MAX_ROWS = 1000;

/**
 * One user row from the cabinet sheet. Email and PIN are only bounded here:
 * the server validates them per row, so one bad row is reported back instead
 * of rejecting the whole sheet.
 */
export const doorPinImportRowSchema = z.object({
	/** Spreadsheet row number, so admins can find the row again. */
	row_number: z.number().int().positive(),
	email: z.string().trim().max(320),
	pin: z.string().trim().max(64),
	given_name: z.string().trim().max(200).optional(),
	surname: z.string().trim().max(200).optional(),
});

export type DoorPinImportRow = z.infer<typeof doorPinImportRowSchema>;

/**
 * Body of `POST /api/admin/door-pins/import`. With `dry_run` the server only
 * reports what applying would do; nothing is written.
 */
export const doorPinImportRequestSchema = z.object({
	dry_run: z.boolean(),
	rows: z.array(doorPinImportRowSchema).min(1).max(DOOR_PIN_IMPORT_MAX_ROWS),
});

export type DoorPinImportRequest = z.infer<typeof doorPinImportRequestSchema>;

/** Why a sheet row with a member match was not imported. */
export const DOOR_PIN_IMPORT_REJECTIONS = [
	"invalid_email",
	"invalid_pin",
	"duplicate_email",
	"duplicate_pin",
	"pin_in_use",
] as const;

export type DoorPinImportRejection =
	(typeof DOOR_PIN_IMPORT_REJECTIONS)[number];

/** A sheet row as the admin sees it. Never carries the PIN. */
export interface DoorPinImportRowRef {
	row_number: number;
	email: string;
	name: string;
}

export interface DoorPinImportRejectedRow extends DoorPinImportRowRef {
	reason: DoorPinImportRejection;
}

export interface DoorPinImportMemberRef {
	user_id: string;
	name: string;
	email: string;
}

/**
 * Response of `POST /api/admin/door-pins/import`. Counts describe the sheet
 * rows; it never contains a PIN.
 */
export interface DoorPinImportResult {
	dry_run: boolean;
	total: number;
	/** Rows whose PIN is (or, in a dry run, would be) stored. */
	matched: number;
	created: number;
	updated: number;
	unchanged: number;
	/** Rows whose email belongs to no member account. */
	unmatched: DoorPinImportRowRef[];
	rejected: DoorPinImportRejectedRow[];
	/** Active members who still have no PIN once these rows are applied. */
	members_without_pin: DoorPinImportMemberRef[];
}
