import { useSetPageHeader } from "@/contexts/PageHeaderContext";

/** Claims the app-shell title only for the standalone Expertise route. */
export function ExpertiseProfileHeaderOwner(): null {
	useSetPageHeader("Expertise");
	return null;
}
