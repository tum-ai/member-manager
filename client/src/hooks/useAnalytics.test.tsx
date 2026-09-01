import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	useAnalytics,
	useAnalyticsPersonProperties,
	useFeatureFlag,
} from "./useAnalytics";

const mocks = vi.hoisted(() => ({
	captureAnalyticsEvent: vi.fn(),
	setAnalyticsPersonProperties: vi.fn(),
	onAnalyticsClient: vi.fn(),
}));

vi.mock("@/lib/analytics", () => mocks);

describe("useAnalytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.onAnalyticsClient.mockImplementation(() => () => {});
	});

	it("returns a stable capture function that forwards to PostHog", () => {
		const { result, rerender } = renderHook(() => useAnalytics());
		const first = result.current;

		rerender();
		result.current.capture("reimbursement_submitted", { amount: 12 });

		expect(result.current).toBe(first);
		expect(mocks.captureAnalyticsEvent).toHaveBeenCalledWith(
			"reimbursement_submitted",
			{ amount: 12 },
		);
	});
});

describe("useFeatureFlag", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("is false while analytics is disabled", () => {
		mocks.onAnalyticsClient.mockImplementation(() => () => {});

		const { result } = renderHook(() => useFeatureFlag("new-finance-view"));

		expect(result.current).toBe(false);
	});

	it("reads the flag and re-reads it when PostHog refreshes flags", () => {
		let notifyFlagsChanged: (() => void) | undefined;
		const isFeatureEnabled = vi.fn().mockReturnValue(true);
		mocks.onAnalyticsClient.mockImplementation(
			(register: (posthog: unknown) => (() => void) | undefined) =>
				register({
					isFeatureEnabled,
					onFeatureFlags: (callback: () => void) => {
						notifyFlagsChanged = callback;
						return () => {};
					},
				}) ?? (() => {}),
		);

		const { result } = renderHook(() => useFeatureFlag("new-finance-view"));

		expect(result.current).toBe(true);
		expect(isFeatureEnabled).toHaveBeenCalledWith("new-finance-view");

		isFeatureEnabled.mockReturnValue(false);
		act(() => notifyFlagsChanged?.());

		expect(result.current).toBe(false);
	});

	it("treats an unknown flag as disabled", () => {
		mocks.onAnalyticsClient.mockImplementation(
			(register: (posthog: unknown) => (() => void) | undefined) =>
				register({
					isFeatureEnabled: () => undefined,
					onFeatureFlags: () => () => {},
				}) ?? (() => {}),
		);

		const { result } = renderHook(() => useFeatureFlag("missing"));

		expect(result.current).toBe(false);
	});
});

describe("useAnalyticsPersonProperties", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("skips properties that are still loading", () => {
		renderHook(() =>
			useAnalyticsPersonProperties({
				department: undefined,
				is_admin: undefined,
			}),
		);

		expect(mocks.setAnalyticsPersonProperties).not.toHaveBeenCalled();
	});

	it("writes defined properties once and again only when a value changes", () => {
		const { rerender } = renderHook(
			(props: { department: string }) => useAnalyticsPersonProperties(props),
			{ initialProps: { department: "Engineering" } },
		);

		rerender({ department: "Engineering" });
		expect(mocks.setAnalyticsPersonProperties).toHaveBeenCalledTimes(1);

		rerender({ department: "Marketing" });
		expect(mocks.setAnalyticsPersonProperties).toHaveBeenCalledTimes(2);
		expect(mocks.setAnalyticsPersonProperties).toHaveBeenLastCalledWith({
			department: "Marketing",
		});
	});
});
