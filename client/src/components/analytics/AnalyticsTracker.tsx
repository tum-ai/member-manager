import type { User } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
	captureAnalyticsPageview,
	identifyAnalyticsUser,
	resetAnalytics,
} from "@/lib/analytics";

interface AnalyticsTrackerProps {
	user: User | null;
}

/**
 * Side-effect-only component: turns React Router navigations into PostHog
 * pageviews and keeps the identified person in sync with the Supabase session.
 *
 * Mounted inside `BrowserRouter` and above the auth gate so the public contract
 * signing pages are tracked too. Renders nothing.
 */
export function AnalyticsTracker({ user }: AnalyticsTrackerProps): null {
	const location = useLocation();
	const identifiedUserId = useRef<string | null>(null);
	const lastTrackedPath = useRef<string | null>(null);

	useEffect(() => {
		if (user) {
			if (identifiedUserId.current === user.id) {
				return;
			}
			identifiedUserId.current = user.id;
			identifyAnalyticsUser({ userId: user.id, email: user.email ?? null });
			return;
		}

		// Logout: drop the person association so the next visitor on this browser
		// is not attributed to the previous member.
		if (identifiedUserId.current !== null) {
			identifiedUserId.current = null;
			resetAnalytics();
		}
	}, [user]);

	useEffect(() => {
		if (lastTrackedPath.current === location.pathname) {
			return;
		}
		lastTrackedPath.current = location.pathname;
		captureAnalyticsPageview();
	}, [location.pathname]);

	return null;
}
