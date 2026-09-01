import type { User } from "@supabase/supabase-js";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsTracker } from "./AnalyticsTracker";

const mocks = vi.hoisted(() => ({
	captureAnalyticsPageview: vi.fn(),
	identifyAnalyticsUser: vi.fn(),
	resetAnalytics: vi.fn(),
}));

vi.mock("@/lib/analytics", () => mocks);

function makeUser(id: string, email?: string): User {
	return { id, email } as User;
}

function renderTracker(user: User | null, initialPath = "/members") {
	return render(
		<MemoryRouter initialEntries={[initialPath]}>
			<AnalyticsTracker user={user} />
			<Routes>
				<Route path="*" element={<div>page</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("AnalyticsTracker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("captures a pageview on mount", () => {
		renderTracker(null);

		expect(mocks.captureAnalyticsPageview).toHaveBeenCalledTimes(1);
	});

	it("does not re-capture a pageview when the path is unchanged", () => {
		const { rerender } = renderTracker(null);

		rerender(
			<MemoryRouter initialEntries={["/members"]}>
				<AnalyticsTracker user={null} />
			</MemoryRouter>,
		);

		expect(mocks.captureAnalyticsPageview).toHaveBeenCalledTimes(1);
	});

	it("identifies the signed-in member exactly once", () => {
		const user = makeUser("user-1", "member@tum-ai.com");
		const { rerender } = renderTracker(user);

		rerender(
			<MemoryRouter initialEntries={["/members"]}>
				<AnalyticsTracker user={makeUser("user-1", "member@tum-ai.com")} />
			</MemoryRouter>,
		);

		expect(mocks.identifyAnalyticsUser).toHaveBeenCalledTimes(1);
		expect(mocks.identifyAnalyticsUser).toHaveBeenCalledWith({
			userId: "user-1",
			email: "member@tum-ai.com",
		});
	});

	it("does not identify anonymous visitors on the public signing pages", () => {
		renderTracker(null, "/contracts/sign/token-123");

		expect(mocks.identifyAnalyticsUser).not.toHaveBeenCalled();
		expect(mocks.resetAnalytics).not.toHaveBeenCalled();
	});

	it("resets the person on logout", () => {
		const { rerender } = renderTracker(makeUser("user-1"));

		rerender(
			<MemoryRouter initialEntries={["/members"]}>
				<AnalyticsTracker user={null} />
			</MemoryRouter>,
		);

		expect(mocks.resetAnalytics).toHaveBeenCalledTimes(1);
	});
});
