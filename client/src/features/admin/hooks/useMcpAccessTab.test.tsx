import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useMcpAccessTab } from "./useMcpAccessTab";

function renderTab(path: string) {
	function Wrapper({ children }: PropsWithChildren) {
		return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
	}
	return renderHook(
		() => ({ ...useMcpAccessTab(), search: useLocation().search }),
		{ wrapper: Wrapper },
	);
}

describe("useMcpAccessTab", () => {
	it("reads the tab from ?tab=, defaulting to Notion", () => {
		expect(renderTab("/admin/mcp-access?tab=dev").result.current.tab).toBe(
			"dev",
		);
		expect(renderTab("/admin/mcp-access").result.current.tab).toBe("notion");
		expect(renderTab("/admin/mcp-access?tab=other").result.current.tab).toBe(
			"notion",
		);
	});

	it("keeps the open tab in the URL", () => {
		const { result } = renderTab("/admin/mcp-access?x=1");

		act(() => result.current.setTab("dev"));
		expect(result.current.search).toBe("?x=1&tab=dev");

		act(() => result.current.setTab("notion"));
		expect(result.current.search).toBe("?x=1");
	});
});
