import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getAnalyticsConfigFromEnv,
	redactAnalyticsPath,
	redactAnalyticsUrl,
	redactCaptureResult,
} from "./analytics";

const mocks = vi.hoisted(() => {
	const client = {
		capture: vi.fn(),
		identify: vi.fn(),
		reset: vi.fn(),
		setPersonProperties: vi.fn(),
	};
	return { client, init: vi.fn(() => client) };
});

vi.mock("posthog-js/dist/module.slim", () => ({
	default: { init: mocks.init },
}));

// The module keeps the loaded client in module scope, so each lifecycle test
// re-imports a fresh copy.
async function importAnalytics(): Promise<typeof import("./analytics")> {
	vi.resetModules();
	return await import("./analytics");
}

const KEY_ENV = { VITE_POSTHOG_KEY: "phc_test_key" };

describe("getAnalyticsConfigFromEnv", () => {
	it("returns null when no project key is configured", () => {
		expect(getAnalyticsConfigFromEnv({})).toBeNull();
		expect(getAnalyticsConfigFromEnv({ VITE_POSTHOG_KEY: "   " })).toBeNull();
	});

	it("defaults to EU cloud with autocapture, replay and email off", () => {
		expect(getAnalyticsConfigFromEnv(KEY_ENV)).toEqual({
			apiKey: "phc_test_key",
			apiHost: "https://eu.i.posthog.com",
			uiHost: "https://eu.posthog.com",
			autocapture: false,
			sessionRecording: false,
			identifyEmail: false,
			debug: false,
		});
	});

	it("parses boolean flags and trims the host", () => {
		const config = getAnalyticsConfigFromEnv({
			...KEY_ENV,
			VITE_POSTHOG_HOST: "https://us.i.posthog.com/",
			VITE_POSTHOG_UI_HOST: "https://us.posthog.com",
			VITE_POSTHOG_AUTOCAPTURE: "true",
			VITE_POSTHOG_SESSION_RECORDING: "1",
			VITE_POSTHOG_IDENTIFY_EMAIL: "yes",
			VITE_POSTHOG_DEBUG: "false",
		});

		expect(config).toMatchObject({
			apiHost: "https://us.i.posthog.com",
			uiHost: "https://us.posthog.com",
			autocapture: true,
			sessionRecording: true,
			identifyEmail: true,
			debug: false,
		});
	});

	it("derives the PostHog app URL from the ingestion host", () => {
		expect(
			getAnalyticsConfigFromEnv({
				...KEY_ENV,
				VITE_POSTHOG_HOST: "https://us.i.posthog.com",
			}),
		).toMatchObject({ uiHost: "https://us.posthog.com" });

		// Self-hosted: the app and the ingestion API share a host.
		expect(
			getAnalyticsConfigFromEnv({
				...KEY_ENV,
				VITE_POSTHOG_HOST: "https://posthog.internal",
				PROD: true,
			}),
		).toMatchObject({ uiHost: "https://posthog.internal" });
	});

	it("accepts a same-origin reverse-proxy path", () => {
		expect(
			getAnalyticsConfigFromEnv({ ...KEY_ENV, VITE_POSTHOG_HOST: "/ingest/" }),
		).toMatchObject({ apiHost: "/ingest", uiHost: "https://eu.posthog.com" });
	});

	it("rejects a personal or secret API key", () => {
		expect(() =>
			getAnalyticsConfigFromEnv({ VITE_POSTHOG_KEY: "phx_secret" }),
		).toThrow(/project API key/i);
		expect(() =>
			getAnalyticsConfigFromEnv({ VITE_POSTHOG_KEY: "phs_secret" }),
		).toThrow(/project API key/i);
	});

	it("requires HTTPS for a remote host in production only", () => {
		expect(() =>
			getAnalyticsConfigFromEnv({
				...KEY_ENV,
				PROD: true,
				VITE_POSTHOG_HOST: "http://posthog.internal",
			}),
		).toThrow(/HTTPS/i);

		expect(
			getAnalyticsConfigFromEnv({
				...KEY_ENV,
				VITE_POSTHOG_HOST: "http://localhost:8000",
			}),
		).toMatchObject({ apiHost: "http://localhost:8000" });
	});

	it("rejects a host that is neither a URL nor a path", () => {
		expect(() =>
			getAnalyticsConfigFromEnv({ ...KEY_ENV, VITE_POSTHOG_HOST: "not a url" }),
		).toThrow(/absolute URL/i);
	});
});

describe("redactAnalyticsPath", () => {
	it("collapses contract signing tokens to the route template", () => {
		expect(redactAnalyticsPath("/contracts/sign/9f3c-secret-token")).toBe(
			"/contracts/sign/:token",
		);
		expect(redactAnalyticsPath("/contracts/board-sign/abc123")).toBe(
			"/contracts/board-sign/:token",
		);
	});

	it("collapses contract draft and submission ids", () => {
		expect(redactAnalyticsPath("/contracts/drafts/17")).toBe(
			"/contracts/drafts/:draftId",
		);
		expect(redactAnalyticsPath("/contracts/submissions/17")).toBe(
			"/contracts/submissions/:id",
		);
	});

	it("redacts UUID and long opaque segments on unknown routes", () => {
		expect(
			redactAnalyticsPath("/members/3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
		).toBe("/members/:redacted");
		expect(redactAnalyticsPath("/x/aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
			"/x/:redacted",
		);
	});

	it("leaves ordinary routes untouched", () => {
		expect(redactAnalyticsPath("/tools/finance/analytics")).toBe(
			"/tools/finance/analytics",
		);
		expect(redactAnalyticsPath("/")).toBe("/");
	});
});

describe("redactAnalyticsUrl", () => {
	it("drops the query string and the fragment", () => {
		// Supabase hands the OAuth session back as a URL fragment.
		expect(
			redactAnalyticsUrl(
				"https://app.example.com/?code=abc#access_token=super-secret",
			),
		).toBe("https://app.example.com/");
	});

	it("redacts the path of an absolute URL", () => {
		expect(
			redactAnalyticsUrl("https://app.example.com/contracts/sign/tok?x=1"),
		).toBe("https://app.example.com/contracts/sign/:token");
	});

	it("falls back to path redaction for a non-URL value", () => {
		expect(redactAnalyticsUrl("/contracts/sign/tok")).toBe(
			"/contracts/sign/:token",
		);
	});
});

describe("redactCaptureResult", () => {
	it("passes through events without properties", () => {
		expect(redactCaptureResult(null)).toBeNull();
	});

	it("redacts URL- and path-valued properties without mutating the input", () => {
		const event = {
			event: "$pageview",
			properties: {
				$current_url:
					"https://app.example.com/contracts/sign/tok#access_token=x",
				$pathname: "/contracts/sign/tok",
				$referrer: "https://app.example.com/members/17?q=secret",
				department: "Engineering",
			},
		} as unknown as Parameters<typeof redactCaptureResult>[0];

		const redacted = redactCaptureResult(event);

		expect(redacted?.properties).toEqual({
			$current_url: "https://app.example.com/contracts/sign/:token",
			$pathname: "/contracts/sign/:token",
			$referrer: "https://app.example.com/members/17",
			department: "Engineering",
		});
		expect(event?.properties.$pathname).toBe("/contracts/sign/tok");
	});
});

describe("analytics lifecycle", () => {
	beforeEach(() => {
		mocks.init.mockClear();
		mocks.client.capture.mockClear();
		mocks.client.identify.mockClear();
		mocks.client.reset.mockClear();
		mocks.client.setPersonProperties.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("stays disabled and never loads posthog-js without a key", async () => {
		const analytics = await importAnalytics();

		await expect(analytics.initAnalytics({})).resolves.toBeNull();
		analytics.captureAnalyticsEvent("something");

		expect(analytics.isAnalyticsEnabled()).toBe(false);
		expect(mocks.init).not.toHaveBeenCalled();
	});

	it("drops events when init was never called", async () => {
		const analytics = await importAnalytics();

		analytics.captureAnalyticsEvent("orphan");

		expect(mocks.client.capture).not.toHaveBeenCalled();
	});

	it("initialises with privacy-preserving defaults", async () => {
		const analytics = await importAnalytics();
		await analytics.initAnalytics(KEY_ENV);

		expect(mocks.init).toHaveBeenCalledTimes(1);
		const [key, config] = mocks.init.mock.calls[0] as unknown as [
			string,
			Record<string, unknown>,
		];

		expect(key).toBe("phc_test_key");
		expect(config).toMatchObject({
			api_host: "https://eu.i.posthog.com",
			person_profiles: "identified_only",
			autocapture: false,
			capture_pageview: false,
			disable_session_recording: true,
		});
		expect(analytics.isAnalyticsEnabled()).toBe(true);
	});

	it("initialises only once", async () => {
		const analytics = await importAnalytics();

		await Promise.all([
			analytics.initAnalytics(KEY_ENV),
			analytics.initAnalytics(KEY_ENV),
		]);

		expect(mocks.init).toHaveBeenCalledTimes(1);
	});

	it("flushes calls made before the client finished loading", async () => {
		const analytics = await importAnalytics();

		const ready = analytics.initAnalytics(KEY_ENV);
		analytics.captureAnalyticsPageview();
		await ready;

		expect(mocks.client.capture).toHaveBeenCalledWith("$pageview", undefined);
	});

	it("identifies without the email unless the deployment opts in", async () => {
		const analytics = await importAnalytics();
		await analytics.initAnalytics(KEY_ENV);

		analytics.identifyAnalyticsUser({
			userId: "user-1",
			email: "member@tum-ai.com",
		});

		expect(mocks.client.identify).toHaveBeenCalledWith("user-1", {});
	});

	it("identifies with the email when opted in", async () => {
		const analytics = await importAnalytics();
		await analytics.initAnalytics({
			...KEY_ENV,
			VITE_POSTHOG_IDENTIFY_EMAIL: "true",
		});

		analytics.identifyAnalyticsUser({
			userId: "user-1",
			email: "member@tum-ai.com",
		});

		expect(mocks.client.identify).toHaveBeenCalledWith("user-1", {
			email: "member@tum-ai.com",
		});
	});

	it("forwards person properties and resets", async () => {
		const analytics = await importAnalytics();
		await analytics.initAnalytics(KEY_ENV);

		analytics.setAnalyticsPersonProperties({ department: "Engineering" });
		analytics.resetAnalytics();

		expect(mocks.client.setPersonProperties).toHaveBeenCalledWith({
			department: "Engineering",
		});
		expect(mocks.client.reset).toHaveBeenCalledTimes(1);
	});

	it("stays disabled and logs when the key is a secret key", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const analytics = await importAnalytics();

		await expect(
			analytics.initAnalytics({ VITE_POSTHOG_KEY: "phx_secret" }),
		).resolves.toBeNull();

		expect(mocks.init).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining("PostHog analytics disabled"),
		);
	});

	it("unsubscribes a client subscription that was registered before load", async () => {
		const analytics = await importAnalytics();
		const cleanup = vi.fn();

		const ready = analytics.initAnalytics(KEY_ENV);
		const unsubscribe = analytics.onAnalyticsClient(() => cleanup);
		unsubscribe();
		await ready;

		expect(cleanup).not.toHaveBeenCalled();
	});
});
