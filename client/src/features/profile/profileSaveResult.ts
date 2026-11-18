export type SavePartStatus = "saved" | "skipped" | "failed";

export interface SavePart {
	status: SavePartStatus;
	/** The failure reason, set when `status` is "failed". */
	message?: string;
}

export interface ProfileSaveOutcome {
	member: SavePart;
	sepa: SavePart;
}

export interface SaveFeedback {
	message: string;
	type: "success" | "error";
}

export function toSavePart(
	result: PromiseSettledResult<unknown> | "skipped",
): SavePart {
	if (result === "skipped") return { status: "skipped" };
	if (result.status === "fulfilled") return { status: "saved" };

	return {
		status: "failed",
		message:
			result.reason instanceof Error ? result.reason.message : "Unknown error",
	};
}

/**
 * The profile is saved as two requests (the member row and the bank details),
 * so one can succeed while the other fails. The toast says which part made it,
 * instead of reporting a failure for a save that half worked (#397).
 */
export function describeSaveOutcome({
	member,
	sepa,
}: ProfileSaveOutcome): SaveFeedback {
	if (member.status !== "failed" && sepa.status !== "failed") {
		return { message: "Profile saved successfully!", type: "success" };
	}

	if (member.status === "failed" && sepa.status === "saved") {
		return {
			message: `Bank details saved, but your profile was not: ${member.message}`,
			type: "error",
		};
	}

	if (member.status === "saved" && sepa.status === "failed") {
		return {
			message: `Profile saved, but your bank details were not: ${sepa.message}`,
			type: "error",
		};
	}

	return {
		message: `Error saving: ${member.message ?? sepa.message}`,
		type: "error",
	};
}
