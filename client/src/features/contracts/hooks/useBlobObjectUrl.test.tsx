import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBlobObjectUrl } from "./useBlobObjectUrl";

describe("useBlobObjectUrl", () => {
	it("creates and revokes an object URL when the blob changes", async () => {
		const createObjectURL = vi.fn(() => "blob:contract");
		const revokeObjectURL = vi.fn();
		URL.createObjectURL = createObjectURL;
		URL.revokeObjectURL = revokeObjectURL;
		const firstBlob = new Blob(["pdf"], { type: "application/pdf" });
		const { result, rerender, unmount } = renderHook(
			({ blob }: { blob: Blob | undefined }) => useBlobObjectUrl(blob),
			{ initialProps: { blob: firstBlob as Blob | undefined } },
		);

		await waitFor(() => expect(result.current).toBe("blob:contract"));
		rerender({ blob: undefined });
		await waitFor(() => expect(result.current).toBeNull());
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:contract");
		unmount();
		expect(createObjectURL).toHaveBeenCalledWith(firstBlob);
	});
});
