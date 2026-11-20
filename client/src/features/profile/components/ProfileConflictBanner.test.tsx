import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileConflictBanner } from "./ProfileConflictBanner";

describe("ProfileConflictBanner", () => {
	it("explains that nothing was saved", () => {
		render(
			<ProfileConflictBanner
				onReloadLatest={vi.fn()}
				onKeepMyChanges={vi.fn()}
			/>,
		);

		expect(screen.getByRole("alert")).toHaveTextContent(/changed elsewhere/i);
		expect(screen.getByRole("alert")).toHaveTextContent(/nothing was saved/i);
	});

	it("lets the member keep their changes or discard them", async () => {
		const user = userEvent.setup();
		const onReloadLatest = vi.fn();
		const onKeepMyChanges = vi.fn();
		render(
			<ProfileConflictBanner
				onReloadLatest={onReloadLatest}
				onKeepMyChanges={onKeepMyChanges}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /keep my changes/i }));
		expect(onKeepMyChanges).toHaveBeenCalledTimes(1);
		expect(onReloadLatest).not.toHaveBeenCalled();

		await user.click(
			screen.getByRole("button", { name: /discard my changes and reload/i }),
		);
		expect(onReloadLatest).toHaveBeenCalledTimes(1);
	});
});
