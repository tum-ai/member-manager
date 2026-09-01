import type { Properties } from "posthog-js/dist/module.slim";
import { useEffect, useMemo, useState } from "react";
import {
	captureAnalyticsEvent,
	onAnalyticsClient,
	setAnalyticsPersonProperties,
} from "@/lib/analytics";

interface Analytics {
	capture: (event: string, properties?: Properties) => void;
}

/**
 * Capture a product event from a feature hook or handler. Safe to call when
 * PostHog is not configured - the event is dropped.
 *
 * Name events `noun_verbed` in past tense, e.g. `reimbursement_submitted`.
 */
export function useAnalytics(): Analytics {
	return useMemo(() => ({ capture: captureAnalyticsEvent }), []);
}

/**
 * Read a PostHog feature flag, re-rendering when the flag payload arrives or
 * changes. Returns `false` while flags are loading and when analytics is off,
 * so a flag-gated feature stays hidden unless PostHog says otherwise.
 */
export function useFeatureFlag(flag: string): boolean {
	const [enabled, setEnabled] = useState(false);

	useEffect(
		() =>
			onAnalyticsClient((posthog) => {
				const readFlag = (): void => {
					setEnabled(posthog.isFeatureEnabled(flag) ?? false);
				};

				readFlag();
				return posthog.onFeatureFlags(readFlag);
			}),
		[flag],
	);

	return enabled;
}

function stripUndefined(properties: Properties): Properties {
	return Object.fromEntries(
		Object.entries(properties).filter(([, value]) => value !== undefined),
	);
}

/**
 * Attach segmentation properties (department, roles) to the identified person.
 * Values still loading should be passed as `undefined` so they are skipped
 * rather than written as a placeholder.
 */
export function useAnalyticsPersonProperties(properties: Properties): void {
	// Callers pass an object literal, so compare by value instead of identity.
	const serialized = JSON.stringify(stripUndefined(properties));

	useEffect(() => {
		const parsed = JSON.parse(serialized) as Properties;
		if (Object.keys(parsed).length === 0) {
			return;
		}
		setAnalyticsPersonProperties(parsed);
	}, [serialized]);
}
