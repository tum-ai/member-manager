import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares a presented secret with the expected one in constant time.
 *
 * Both sides are hashed to a fixed 32-byte digest first, so `timingSafeEqual`
 * always gets equal-length inputs. That removes the length-dependent early
 * return, which would otherwise leak the secret's length via response timing.
 */
export function constantTimeEquals(a: string, b: string): boolean {
	const aHash = createHash("sha256").update(a).digest();
	const bHash = createHash("sha256").update(b).digest();
	return timingSafeEqual(aHash, bHash);
}

/**
 * Whether an `Authorization: Bearer <token>` header carries `expected`.
 * False for a missing header, another scheme or an empty token.
 */
export function hasBearerToken(
	header: string | undefined,
	expected: string,
): boolean {
	const presented = header?.startsWith("Bearer ")
		? header.slice("Bearer ".length).trim()
		: "";
	return presented !== "" && constantTimeEquals(presented, expected);
}
