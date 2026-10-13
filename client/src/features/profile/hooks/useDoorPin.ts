import type { MemberDoorPin } from "@member-manager/shared";
import { useState } from "react";
import { useMemberDoorPin } from "@/hooks/useMemberDoorPin";

export interface UseDoorPinResult {
	doorPin: MemberDoorPin | undefined;
	isLoading: boolean;
	hasError: boolean;
	isRevealed: boolean;
	toggleRevealed: () => void;
}

/**
 * State for the profile's Door PIN card: the member's own PIN (held back by
 * the server until /welcome is saved) and whether it is shown in clear.
 * The PIN starts hidden on every visit.
 */
export function useDoorPin(userId: string): UseDoorPinResult {
	const { doorPin, isLoading, error } = useMemberDoorPin(userId);
	const [isRevealed, setIsRevealed] = useState(false);

	return {
		doorPin,
		isLoading,
		hasError: Boolean(error),
		isRevealed,
		toggleRevealed: () => setIsRevealed((current) => !current),
	};
}
