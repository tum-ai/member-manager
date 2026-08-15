import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TAccountMatchView } from "@/features/finance/financeTAccountUtils";
import { renderWithClient } from "@/test/renderWithClient";
import {
	DetailBlock,
	DetailField,
	DetailList,
	TAccountMatchList,
} from "./FinanceTAccountDetailList";

const match: TAccountMatchView = {
	key: "match-1",
	label: "Venue-Miete",
	amount: 2380,
};

describe("DetailField", () => {
	it("renders the value it is given", () => {
		renderWithClient(
			<DetailList>
				<DetailField label="Belegnummer" value="RE-2026-0042" />
			</DetailList>,
		);

		expect(screen.getByText("Belegnummer")).toBeInTheDocument();
		expect(screen.getByText("RE-2026-0042")).toBeInTheDocument();
	});

	// An unknown value and a zero value are different facts (FR-N5): a missing
	// one must read as an em dash, never as "0".
	it("falls back to an em dash for a missing value", () => {
		renderWithClient(
			<DetailList>
				<DetailField label="Steuersatz" value={null} />
			</DetailList>,
		);

		expect(screen.getByText("—")).toBeInTheDocument();
	});
});

describe("DetailBlock", () => {
	it("renders its title and children", () => {
		renderWithClient(
			<DetailBlock title="Zuordnung">
				<p>Automatisch</p>
			</DetailBlock>,
		);

		expect(screen.getByText("Zuordnung")).toBeInTheDocument();
		expect(screen.getByText("Automatisch")).toBeInTheDocument();
	});
});

describe("TAccountMatchList", () => {
	it("shows the empty label when nothing is matched", () => {
		renderWithClient(
			<TAccountMatchList matches={[]} emptyLabel="Noch nichts verknüpft." />,
		);

		expect(screen.getByText("Noch nichts verknüpft.")).toBeInTheDocument();
	});

	it("lists each match with its amount", () => {
		renderWithClient(<TAccountMatchList matches={[match]} emptyLabel="leer" />);

		expect(screen.getByText("Venue-Miete")).toBeInTheDocument();
		expect(screen.getByText(/2\.380,00/)).toBeInTheDocument();
	});

	// A read-only viewer sees the match but cannot break it (FR-K6).
	it("omits the detach button without an onDetach handler", () => {
		renderWithClient(<TAccountMatchList matches={[match]} emptyLabel="leer" />);

		expect(
			screen.queryByRole("button", { name: /entfernen/ }),
		).not.toBeInTheDocument();
	});

	it("detaches the match it was clicked on", async () => {
		const onDetach = vi.fn();
		renderWithClient(
			<TAccountMatchList
				matches={[match]}
				emptyLabel="leer"
				onDetach={onDetach}
			/>,
		);

		await userEvent.click(
			screen.getByRole("button", { name: "Zuordnung Venue-Miete entfernen" }),
		);

		expect(onDetach).toHaveBeenCalledWith("match-1");
	});
});
