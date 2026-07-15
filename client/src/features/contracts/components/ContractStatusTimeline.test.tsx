import type { ContractStatusEvent } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContractStatusTimeline } from "./ContractStatusTimeline";

function makeEvent(
	overrides: Partial<ContractStatusEvent> = {},
): ContractStatusEvent {
	return {
		id: "event-1",
		submission_id: "sub-1",
		from_status: "legal_review",
		to_status: "approved",
		changed_by: "user-1",
		changed_by_name: "Lena Legal",
		note: null,
		created_at: "2026-07-10T10:00:00Z",
		...overrides,
	};
}

describe("ContractStatusTimeline", () => {
	it("renders regular transitions as from → to", () => {
		render(<ContractStatusTimeline events={[makeEvent()]} />);

		expect(screen.getByText(/Legal review →/)).toBeInTheDocument();
		expect(screen.getByText("Approved")).toBeInTheDocument();
		expect(screen.getByText(/by Lena Legal/)).toBeInTheDocument();
	});

	// The initial event (from_status null) reads as a submission.
	it("renders the initial event as Submitted", () => {
		render(
			<ContractStatusTimeline
				events={[
					makeEvent({
						from_status: null,
						to_status: "legal_review",
						changed_by_name: "Paula Partners",
					}),
				]}
			/>,
		);

		expect(screen.getByText(/Submitted as/)).toBeInTheDocument();
		expect(screen.getByText("Legal review")).toBeInTheDocument();
		expect(screen.getByText(/by Paula Partners/)).toBeInTheDocument();
	});

	it("renders an initial draft event as Draft created", () => {
		render(
			<ContractStatusTimeline
				events={[makeEvent({ from_status: null, to_status: "draft" })]}
			/>,
		);

		expect(screen.getByText("Draft created")).toBeInTheDocument();
	});

	// Manual override changes are phrased distinctly.
	it("renders manual overrides with distinct phrasing", () => {
		render(
			<ContractStatusTimeline
				events={[
					makeEvent({
						from_status: "approved",
						to_status: "in_review",
						note: "Manual override",
					}),
				]}
			/>,
		);

		expect(
			screen.getByText(/Status manually changed from Approved to/),
		).toBeInTheDocument();
		expect(screen.getByText("In review")).toBeInTheDocument();
	});

	it("renders nothing while loading or without events", () => {
		const { container: loading } = render(
			<ContractStatusTimeline events={[makeEvent()]} loading />,
		);
		expect(loading).toBeEmptyDOMElement();

		const { container: empty } = render(<ContractStatusTimeline events={[]} />);
		expect(empty).toBeEmptyDOMElement();
	});
});
