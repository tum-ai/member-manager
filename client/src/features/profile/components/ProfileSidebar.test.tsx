import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileSidebar } from "./ProfileSidebar";

function renderSidebar(
	overrides: Partial<React.ComponentProps<typeof ProfileSidebar>> = {},
) {
	const props: React.ComponentProps<typeof ProfileSidebar> = {
		avatarUrl: null,
		headerFullName: "Alice Example",
		headerInitials: "AE",
		headerMeta: "Member · Engineering",
		isActive: true,
		memberStatus: "active",
		completeness: 80,
		isGeneratingPdf: false,
		canDownloadProof: true,
		onDownloadMembershipProof: vi.fn(),
		navItems: [
			{ id: "personal", label: "Personal" },
			{ id: "banking", label: "Banking" },
		],
		activeSection: "personal",
		onNavClick: vi.fn(),
		isUpdating: false,
		...overrides,
	};
	render(<ProfileSidebar {...props} />);
	return props;
}

describe("ProfileSidebar", () => {
	it("renders the member header and completeness", () => {
		renderSidebar();

		expect(
			screen.getByRole("heading", { name: "Alice Example" }),
		).toBeInTheDocument();
		expect(screen.getByText("Member · Engineering")).toBeInTheDocument();
		expect(screen.getByText("80%")).toBeInTheDocument();
		expect(screen.getByText(/active member/i)).toBeInTheDocument();
	});

	it("downloads the membership proof", async () => {
		const user = userEvent.setup();
		const props = renderSidebar();

		await user.click(
			screen.getByRole("button", { name: /proof of membership/i }),
		);

		expect(props.onDownloadMembershipProof).toHaveBeenCalledOnce();
	});

	it("disables the proof button while a PDF is generating", () => {
		renderSidebar({ isGeneratingPdf: true });

		expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
	});

	it("disables proof download when not available", () => {
		renderSidebar({ canDownloadProof: false });

		expect(
			screen.getByRole("button", { name: /proof of membership/i }),
		).toBeDisabled();
	});

	it("navigates via the on-this-page links", async () => {
		const user = userEvent.setup();
		const props = renderSidebar();

		await user.click(screen.getByRole("link", { name: "Banking" }));

		expect(props.onNavClick).toHaveBeenCalledWith(expect.anything(), "banking");
	});

	it("disables the save button while updating", () => {
		renderSidebar({ isUpdating: true });

		expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
	});
});
