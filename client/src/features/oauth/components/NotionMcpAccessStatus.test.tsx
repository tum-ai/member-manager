import type { OwnMcpAccess } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotionMcpAccessStatus } from "./NotionMcpAccessStatus";

const renderStatus = (access: OwnMcpAccess | null, state = {}) =>
	render(
		<NotionMcpAccessStatus
			access={access}
			isLoading={false}
			hasError={false}
			{...state}
		/>,
	);

describe("NotionMcpAccessStatus", () => {
	it.each([
		[{ status: "none", role: null }, "not requested yet"],
		[{ status: "pending", role: null }, "waiting for approval"],
		[{ status: "approved", role: "editor" }, "approved as editor"],
		[{ status: "approved", role: "reader" }, "approved as reader"],
		[{ status: "denied", role: null }, "declined"],
	] as const)("shows %o as %s", (access, summary) => {
		renderStatus(access);

		expect(screen.getByTestId("notion-mcp-access-status")).toHaveTextContent(
			`Notion MCP access: ${summary}`,
		);
	});

	it("tells a reader they can only read", () => {
		renderStatus({ status: "approved", role: "reader" });

		expect(screen.getByText(/can search and read/)).toBeVisible();
	});

	it("shows nothing while loading or after an error", () => {
		const { container, rerender } = renderStatus(null, { hasError: true });
		expect(container).toBeEmptyDOMElement();

		rerender(
			<NotionMcpAccessStatus access={null} isLoading hasError={false} />,
		);
		expect(screen.queryByTestId("notion-mcp-access-status")).toBeNull();
	});
});
