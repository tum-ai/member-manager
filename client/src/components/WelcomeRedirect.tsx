import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemberConsents } from "@/hooks/useMemberConsents";
import {
	consumePostLoginPath,
	isWelcomeSkipped,
} from "@/lib/postLoginRedirect";

export const WELCOME_PATH = "/welcome";

/**
 * Routing side effects that run once per sign-in, before the member uses the
 * app:
 * 1. Resume the path a logged-out visitor opened (e.g. a /welcome link from
 *    Slack), which the OAuth round trip dropped.
 * 2. Otherwise send members who haven't decided on their consents yet to
 *    /welcome, unless they chose "Later" in this browser session.
 *
 * Renders nothing.
 */
export function WelcomeRedirect({ userId }: { userId: string }): null {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { consents } = useMemberConsents(userId);
	const resumedPath = useRef(false);
	const checkedConsents = useRef(false);

	useEffect(() => {
		if (resumedPath.current) return;
		resumedPath.current = true;
		const path = consumePostLoginPath();
		if (path && path !== pathname) {
			// The resumed link is where the member asked to go; don't also
			// redirect them for consents on top of it.
			checkedConsents.current = true;
			navigate(path, { replace: true });
		}
	}, [navigate, pathname]);

	useEffect(() => {
		if (checkedConsents.current || !consents) return;
		checkedConsents.current = true;
		if (
			consents.consents_decided_at === null &&
			pathname !== WELCOME_PATH &&
			!isWelcomeSkipped()
		) {
			// Remember the interrupted page so "Later" can return to it.
			navigate(WELCOME_PATH, { replace: true, state: { from: pathname } });
		}
	}, [consents, navigate, pathname]);

	return null;
}
