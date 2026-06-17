import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminFilters } from "@/features/admin/adminUtils";
import { AdminFilterBar } from "./AdminFilterBar";

const emptyFilters: AdminFilters = {
	search: "",
	mandateAgreed: "",
	privacyAgreed: "",
	dataPrivacyNoticeAgreed: "",
	active: "",
};

function renderBar(
	overrides: Partial<React.ComponentProps<typeof AdminFilterBar>> = {},
) {
	const props: React.ComponentProps<typeof AdminFilterBar> = {
		filters: emptyFilters,
		setFilters: vi.fn(),
		canExport: true,
		onExportCsv: vi.fn(),
		onExportExcel: vi.fn(),
		onDownloadEmails: vi.fn(),
		...overrides,
	};
	render(<AdminFilterBar {...props} />);
	return props;
}

describe("AdminFilterBar", () => {
	it("renders the search value and patches only search on change", () => {
		const props = renderBar({ filters: { ...emptyFilters, search: "ada" } });

		const input = screen.getByLabelText(/search members/i);
		expect(input).toHaveValue("ada");

		fireEvent.change(input, { target: { value: "adax" } });

		expect(props.setFilters).toHaveBeenCalledOnce();
		const updater = vi.mocked(props.setFilters).mock.calls[0][0] as (
			f: AdminFilters,
		) => AdminFilters;
		// The functional updater patches `search` and leaves other filters intact.
		const result = updater({ ...emptyFilters, active: "active" });
		expect(result.active).toBe("active");
		expect(typeof result.search).toBe("string");
	});

	it("offers CSV and Excel export actions", async () => {
		const user = userEvent.setup();
		const props = renderBar();

		await user.click(screen.getByRole("button", { name: /export/i }));
		await user.click(await screen.findByRole("menuitem", { name: /csv/i }));
		expect(props.onExportCsv).toHaveBeenCalledOnce();

		await user.click(screen.getByRole("button", { name: /export/i }));
		await user.click(await screen.findByRole("menuitem", { name: /excel/i }));
		expect(props.onExportExcel).toHaveBeenCalledOnce();
	});

	it("downloads emails", async () => {
		const user = userEvent.setup();
		const props = renderBar();

		await user.click(screen.getByRole("button", { name: /download emails/i }));

		expect(props.onDownloadEmails).toHaveBeenCalledOnce();
	});

	it("disables export actions when nothing can be exported", () => {
		renderBar({ canExport: false });

		expect(screen.getByRole("button", { name: /^export/i })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /download emails/i }),
		).toBeDisabled();
	});

	it("updates a boolean filter via its select", async () => {
		const user = userEvent.setup();
		const props = renderBar();

		await user.click(screen.getByRole("combobox", { name: /sepa mandate/i }));
		await user.click(await screen.findByRole("option", { name: "Accepted" }));

		const updater = vi.mocked(props.setFilters).mock.calls.at(-1)?.[0] as (
			f: AdminFilters,
		) => AdminFilters;
		expect(updater(emptyFilters)).toMatchObject({ mandateAgreed: "true" });
	});
});
