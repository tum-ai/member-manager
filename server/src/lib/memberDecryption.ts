import type { FastifyRequest } from "fastify";
import {
	decryptRecordSafely,
	SENSITIVE_MEMBER_FIELDS,
} from "./sensitiveData.js";

// Decrypts a member row for an API response. A field that cannot be decrypted
// (for example one encrypted with a key that is no longer configured) comes
// back blank and is logged with the member and field name, so one bad value
// never fails the whole request. Routes that have already written the row rely
// on this: a strict decrypt there turns a committed save into a 500.
export function decryptMemberForResponse<T extends Record<string, unknown>>(
	member: T,
	userId: unknown,
	request: FastifyRequest,
): T {
	return decryptRecordSafely(
		member,
		SENSITIVE_MEMBER_FIELDS,
		({ field, error }) => {
			request.log.warn(
				{ err: error, userId, field },
				"Failed to decrypt member field; returning blank value",
			);
		},
	);
}
