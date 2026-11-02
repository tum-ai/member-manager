import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import { McpAccessConfirmDialog } from "./McpAccessConfirmDialog";

describe("McpAccessConfirmDialog", () => {
	it("confirms a denial with the admin's note", async () => {
		const onConfirm = vi.fn();
		render(
			<McpAccessConfirmDialog
				confirmation={{ entry: mcpAccessEntry(), action: "deny" }}
				onCancel={vi.fn()}
				onConfirm={onConfirm}
			/>,
		);

		expect(
			screen.getByRole("dialog", { name: "Deny Ada Lovelace's request?" }),
		).toBeVisible();
		await userEvent.type(
			screen.getByLabelText("Note for admins (optional)"),
			"Not in a project yet",
		);
		await userEvent.click(screen.getByRole("button", { name: "Deny" }));

		expect(onConfirm).toHaveBeenCalledWith("Not in a project yet");
	});

	it("explains a revoke and can be cancelled", async () => {
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		render(
			<McpAccessConfirmDialog
				confirmation={{
					entry: mcpAccessEntry({ status: "approved", role: "editor" }),
					action: "revoke",
				}}
				onCancel={onCancel}
				onConfirm={onConfirm}
			/>,
		);

		expect(screen.getByRole("dialog")).toHaveTextContent(
			/lose access to TUM\.ai's Notion within about a minute/,
		);
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onCancel).toHaveBeenCalled();
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("renders nothing without a confirmation", () => {
		render(
			<McpAccessConfirmDialog
				confirmation={null}
				onCancel={vi.fn()}
				onConfirm={vi.fn()}
			/>,
		);

		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
