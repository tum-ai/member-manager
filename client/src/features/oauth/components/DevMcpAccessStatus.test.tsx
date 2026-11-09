import type { OwnDevMcpAccess } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevMcpAccessStatus } from "./DevMcpAccessStatus";

const renderStatus = (access: OwnDevMcpAccess | null, state = {}) =>
	render(
		<DevMcpAccessStatus
			access={access}
			isLoading={false}
			hasError={false}
			{...state}
		/>,
	);

describe("DevMcpAccessStatus", () => {
	it.each([
		[{ status: "none", role: null, tools: [] }, "not requested yet"],
		[{ status: "requested", role: null, tools: [] }, "waiting for approval"],
		[{ status: "active", role: "lead", tools: ["whoami"] }, "active as lead"],
		[{ status: "suspended", role: null, tools: [] }, "suspended"],
		[{ status: "denied", role: null, tools: [] }, "declined"],
	] satisfies Array<
		[OwnDevMcpAccess, string]
	>)("shows %o as %s", (access, summary) => {
		renderStatus(access);

		expect(screen.getByTestId("dev-mcp-access-status")).toHaveTextContent(
			`Dev MCP access: ${summary}`,
		);
	});

	it("lists an active member's tools", () => {
		renderStatus({
			status: "active",
			role: "member",
			tools: ["create_notion_page", "whoami"],
		});

		expect(
			screen.getByText(/can use 2 tools: create_notion_page, whoami/),
		).toBeVisible();
	});

	it("says when an active member has no tools", () => {
		renderStatus({ status: "active", role: "member", tools: [] });

		expect(screen.getByText(/No tools are granted yet/)).toBeVisible();
	});

	it("shows nothing after an error, and a placeholder while loading", () => {
		const { container, rerender } = renderStatus(null, { hasError: true });
		expect(container).toBeEmptyDOMElement();

		rerender(<DevMcpAccessStatus access={null} isLoading hasError={false} />);
		expect(screen.queryByTestId("dev-mcp-access-status")).toBeNull();
	});
});
