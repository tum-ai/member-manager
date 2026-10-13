import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWelcomeRequirements } from "@/features/welcome/hooks/useWelcomeRequirements";
import { consumePostLoginPath } from "@/lib/postLoginRedirect";

export const WELCOME_PATH = "/welcome";

/**
 * Routing side effects for a signed-in member:
 * 1. Once per sign-in, resume the path a logged-out visitor opened (e.g. a
 *    /welcome link from Slack), which the OAuth round trip dropped.
 * 2. On every navigation, keep members who haven't finished /welcome (consent
 *    decision, plus a CV for active members) on /welcome. There is no skip;
 *    the interrupted page is passed along so /welcome can return to it.
 *
 * Renders nothing.
 */
export function WelcomeRedirect({ userId }: { userId: string }): null {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { status } = useWelcomeRequirements(userId);
	const resumedPath = useRef(false);

	useEffect(() => {
		if (!resumedPath.current) {
			resumedPath.current = true;
			const path = consumePostLoginPath();
			if (path && path !== pathname) {
				// Go there first; the next run sends an unfinished member on to
				// /welcome with this path as the page to come back to.
				navigate(path, { replace: true });
				return;
			}
		}
		if (status === "incomplete" && pathname !== WELCOME_PATH) {
			navigate(WELCOME_PATH, { replace: true, state: { from: pathname } });
		}
	}, [status, navigate, pathname]);

	return null;
}
