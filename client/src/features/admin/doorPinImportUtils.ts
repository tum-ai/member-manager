import {
	DOOR_PIN_IMPORT_MAX_ROWS,
	type DoorPinImportRejection,
	type DoorPinImportRow,
} from "@member-manager/shared";

/**
 * Reading the Traka21 "Benutzer & Schlüssel" user sheet that the key cabinet
 * imports and exports. The sheet has a few title rows, then a header row
 * (Vorname, Nachname, Kontakt, UserID, PIN, Admin, …, Löschen) and one row per
 * cabinet user. `Kontakt` holds the member's email.
 */

/** One cell as `read-excel-file` returns it. */
export type SheetCell = string | number | boolean | Date | null | undefined;

export type DoorPinSheetSkipReason =
	| "cabinet_admin"
	| "marked_for_deletion"
	| "missing_email"
	| "missing_pin";

export interface DoorPinSheetSkippedRow {
	row_number: number;
	email: string;
	name: string;
	reason: DoorPinSheetSkipReason;
}

export interface ParsedDoorPinSheet {
	rows: DoorPinImportRow[];
	/** Rows left out before anything is sent to the server. */
	skipped: DoorPinSheetSkippedRow[];
}

export class DoorPinSheetError extends Error {}

// Header labels the cabinet uses (German UI) plus English equivalents.
const COLUMN_ALIASES = {
	email: ["kontakt", "contact", "e-mail", "email"],
	pin: ["pin"],
	givenName: ["vorname", "first name", "forename", "given name"],
	surname: ["nachname", "last name", "surname", "family name"],
	admin: ["admin"],
	deleted: ["löschen", "delete", "deleted"],
} as const;

type Column = keyof typeof COLUMN_ALIASES;

const YES_VALUES = new Set(["y", "yes", "j", "ja", "x", "true"]);

export const DOOR_PIN_SKIP_LABELS: Record<DoorPinSheetSkipReason, string> = {
	cabinet_admin: "Cabinet admin account",
	marked_for_deletion: "Marked for deletion in the sheet",
	missing_email: "No email in Kontakt",
	missing_pin: "No PIN",
};

export const DOOR_PIN_REJECTION_LABELS: Record<DoorPinImportRejection, string> =
	{
		invalid_email: "Not a valid email",
		invalid_pin: "PIN isn't 4 to 10 digits",
		duplicate_email: "Email appears more than once in the sheet",
		duplicate_pin: "PIN appears more than once in the sheet",
		pin_in_use: "Another member already has this PIN",
	};

function normalizeHeader(cell: SheetCell): string {
	return typeof cell === "string" ? cell.trim().toLowerCase() : "";
}

/**
 * A cell as text. Excel stores PINs typed into the cabinet sheet as numbers,
 * so whole numbers are written out without separators or exponents.
 */
export function cellText(cell: SheetCell): string {
	if (typeof cell === "string") return cell.trim();
	if (typeof cell === "number" && Number.isFinite(cell)) {
		return Number.isInteger(cell)
			? BigInt(cell).toString()
			: String(cell).trim();
	}
	return "";
}

function findColumns(row: SheetCell[]): Partial<Record<Column, number>> | null {
	const headers = row.map(normalizeHeader);
	const columns: Partial<Record<Column, number>> = {};
	for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as Array<
		[Column, readonly string[]]
	>) {
		const index = headers.findIndex((header) => aliases.includes(header));
		if (index !== -1) columns[column] = index;
	}
	return columns.email !== undefined && columns.pin !== undefined
		? columns
		: null;
}

/**
 * Turn the sheet's rows into import rows. Row numbers are the spreadsheet's
 * (1-based) so admins can find a row again. Throws `DoorPinSheetError` when
 * the sheet isn't a cabinet user sheet.
 */
export function parseTrakaUserSheet(data: SheetCell[][]): ParsedDoorPinSheet {
	let headerIndex = -1;
	let columns: Partial<Record<Column, number>> | null = null;
	for (let index = 0; index < data.length; index += 1) {
		columns = findColumns(data[index] ?? []);
		if (columns) {
			headerIndex = index;
			break;
		}
	}
	if (!columns || headerIndex === -1) {
		throw new DoorPinSheetError(
			"This doesn't look like the Traka21 user sheet: no header row with Kontakt and PIN columns.",
		);
	}

	const read = (row: SheetCell[], column: Column): string => {
		const index = columns?.[column];
		return index === undefined ? "" : cellText(row[index]);
	};

	const rows: DoorPinImportRow[] = [];
	const skipped: DoorPinSheetSkippedRow[] = [];
	for (let index = headerIndex + 1; index < data.length; index += 1) {
		const row = data[index] ?? [];
		const rowNumber = index + 1;
		const email = read(row, "email");
		const pin = read(row, "pin");
		const givenName = read(row, "givenName");
		const surname = read(row, "surname");
		if (!email && !pin && !givenName && !surname) continue;

		const name = `${givenName} ${surname}`.trim();
		const skip = (reason: DoorPinSheetSkipReason) =>
			skipped.push({ row_number: rowNumber, email, name, reason });
		if (YES_VALUES.has(read(row, "admin").toLowerCase())) {
			skip("cabinet_admin");
		} else if (YES_VALUES.has(read(row, "deleted").toLowerCase())) {
			skip("marked_for_deletion");
		} else if (!email) {
			skip("missing_email");
		} else if (!pin) {
			skip("missing_pin");
		} else {
			rows.push({
				row_number: rowNumber,
				email,
				pin,
				...(givenName ? { given_name: givenName } : {}),
				...(surname ? { surname } : {}),
			});
		}
	}

	if (rows.length === 0) {
		throw new DoorPinSheetError("The sheet has no user rows with a PIN.");
	}
	if (rows.length > DOOR_PIN_IMPORT_MAX_ROWS) {
		throw new DoorPinSheetError(
			`The sheet has ${rows.length} users; the cabinet holds at most ${DOOR_PIN_IMPORT_MAX_ROWS}.`,
		);
	}
	return { rows, skipped };
}
