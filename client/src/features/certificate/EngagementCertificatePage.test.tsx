import { ThemeProvider } from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import EngagementCertificatePage from "./EngagementCertificatePage";

const { submitRequestAsync, showToast } = vi.hoisted(() => ({
	submitRequestAsync: vi.fn(),
	showToast: vi.fn(),
}));

vi.mock("../../hooks/useMemberData", () => ({
	useMemberData: () => ({
		member: {
			user_id: "user-123",
			given_name: "Test",
			surname: "User",
			salutation: "",
			date_of_birth: "1999-01-01",
			member_status: "active",
			active: true,
		},
		isLoading: false,
		error: null,
	}),
}));

vi.mock("../../hooks/useEngagementCertificateRequests", () => ({
	useEngagementCertificateRequests: () => ({
		requests: [],
		submitRequestAsync,
		isSubmitting: false,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({
		showToast,
	}),
}));

vi.mock("../../lib/pdfUtils", () => ({
	downloadPdfBlob: vi.fn(),
	formatGermanDate: () => "01.01.1999",
}));

const mockUser = {
	id: "user-123",
	email: "user@test.com",
} as User;

function renderPage() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<EngagementCertificatePage user={mockUser} />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("EngagementCertificatePage", () => {
	it("submits an approval request instead of downloading immediately", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.type(screen.getByLabelText(/start date/i), "2025-10-01");
		await user.type(screen.getByLabelText(/end date/i), "2026-03-31");
		await user.click(screen.getByLabelText(/weekly hours/i));
		await user.click(await screen.findByRole("option", { name: /10 hours/i }));
		await user.click(screen.getByLabelText(/^department$/i));
		await user.click(
			await screen.findByRole("option", { name: /software development/i }),
		);
		await user.type(
			screen.getByLabelText(/tasks \/ responsibilities/i),
			"Built internal tooling",
		);

		await user.click(
			screen.getByRole("button", { name: /submit for approval/i }),
		);

		await waitFor(() => expect(submitRequestAsync).toHaveBeenCalledTimes(1));
	});
});
