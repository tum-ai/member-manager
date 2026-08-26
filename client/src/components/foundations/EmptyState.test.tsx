import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
	it("renders its optional guidance and keyboard-operable action", async () => {
		const user = userEvent.setup();
		const onCreate = vi.fn();
		render(
			<EmptyState
				icon={Inbox}
				title="No requests yet"
				description="Create the first request."
				action={<Button onClick={onCreate}>Create request</Button>}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "No requests yet" }),
		).toBeVisible();
		expect(screen.getByText("Create the first request.")).toBeVisible();
		await user.tab();
		await user.keyboard("{Enter}");
		expect(onCreate).toHaveBeenCalledOnce();
	});
});
