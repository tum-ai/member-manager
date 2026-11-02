import type { McpAccessEntry } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import { McpAccessCard } from "./McpAccessCard";

function renderCard(entry: McpAccessEntry, isBusy = false) {
	const handlers = {
		onApprove: vi.fn(),
		onSetRole: vi.fn(),
		onDeny: vi.fn(),
		onRevoke: vi.fn(),
	};
	render(<McpAccessCard entry={entry} isBusy={isBusy} {...handlers} />);
	return handlers;
}

describe("McpAccessCard", () => {
	it("shows who asked, when, and the last use", () => {
		renderCard(mcpAccessEntry());

		expect(screen.getByText("Ada Lovelace")).toBeVisible();
		expect(screen.getByText("Software Development")).toBeVisible();
		expect(screen.getByText("Requested 2 Nov 2026, 11:00")).toBeVisible();
		expect(
			screen.getByText("Last used 2 Nov 2026, 11:00 with Claude Code"),
		).toBeVisible();
	});

	it("approves a pending request as editor by default, or as reader", async () => {
		const handlers = renderCard(mcpAccessEntry());

		await userEvent.click(
			screen.getByRole("button", { name: "Approve Ada Lovelace as editor" }),
		);
		expect(handlers.onApprove).toHaveBeenLastCalledWith("editor");

		await userEvent.click(screen.getByRole("radio", { name: "Reader" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Approve Ada Lovelace as reader" }),
		);
		expect(handlers.onApprove).toHaveBeenLastCalledWith("reader");
	});

	it("keeps the picked role when it's clicked again", async () => {
		const handlers = renderCard(mcpAccessEntry());

		await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Approve Ada Lovelace as editor" }),
		);

		expect(handlers.onApprove).toHaveBeenCalledWith("editor");
	});

	it("asks to deny a pending request", async () => {
		const handlers = renderCard(mcpAccessEntry());

		await userEvent.click(
			screen.getByRole("button", {
				name: "Deny Notion MCP access for Ada Lovelace",
			}),
		);

		expect(handlers.onDeny).toHaveBeenCalled();
		expect(handlers.onApprove).not.toHaveBeenCalled();
	});

	it("changes an approved member's role and offers to revoke", async () => {
		const handlers = renderCard(
			mcpAccessEntry({
				status: "approved",
				role: "editor",
				decided_at: "2026-11-02T12:00:00Z",
				decided_by_name: "Grace Hopper",
			}),
		);

		expect(
			screen.getByText("Approved as editor 2 Nov 2026, 13:00 by Grace Hopper"),
		).toBeVisible();
		expect(screen.queryByRole("button", { name: /^approve/i })).toBeNull();

		await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
		expect(handlers.onSetRole).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole("radio", { name: "Reader" }));
		expect(handlers.onSetRole).toHaveBeenCalledWith("reader");

		await userEvent.click(
			screen.getByRole("button", {
				name: "Revoke Notion MCP access for Ada Lovelace",
			}),
		);
		expect(handlers.onRevoke).toHaveBeenCalled();
	});

	it("approves a declined member again, and shows the note", async () => {
		const handlers = renderCard(
			mcpAccessEntry({ status: "denied", decision_note: "Left the team" }),
		);

		expect(screen.getByText("Note: Left the team")).toBeVisible();
		expect(screen.queryByRole("button", { name: /^deny/i })).toBeNull();
		await userEvent.click(
			screen.getByRole("button", { name: "Approve Ada Lovelace as editor" }),
		);
		expect(handlers.onApprove).toHaveBeenCalledWith("editor");
		expect(screen.getByText(/approve again as/i)).toBeVisible();
	});

	it("flags members who aren't active", () => {
		renderCard(mcpAccessEntry({ member_status: "alumni" }));

		expect(screen.getByText("Alumni")).toBeVisible();
		expect(screen.getByText(/refuses members who aren't active/)).toBeVisible();
	});

	it("disables everything while a decision is saved", () => {
		renderCard(mcpAccessEntry(), true);

		for (const button of screen.getAllByRole("button")) {
			expect(button).toBeDisabled();
		}
		for (const radio of screen.getAllByRole("radio")) {
			expect(radio).toBeDisabled();
		}
	});
});
