import { zodResolver } from "@hookform/resolvers/zod";
import {
	type JobPostingFormInput,
	type JobPostingInput,
	jobPostingInputSchema,
} from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { emptyAdminJobForm } from "@/features/admin/adminJobRequestsUtils";
import { AdminJobEditorDialog } from "./AdminJobEditorDialog";

function Harness({
	isSaving,
	onClose,
}: {
	isSaving: boolean;
	onClose: () => void;
}) {
	const form = useForm<JobPostingFormInput, unknown, JobPostingInput>({
		resolver: zodResolver(jobPostingInputSchema),
		defaultValues: emptyAdminJobForm,
	});
	return (
		<AdminJobEditorDialog
			mode="create"
			form={form}
			isSaving={isSaving}
			onClose={onClose}
			onSubmit={form.handleSubmit(() => {})}
		/>
	);
}

describe("AdminJobEditorDialog", () => {
	it("blocks every visible close path while saving", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<Harness isSaving onClose={onClose} />);

		await user.keyboard("{Escape}");
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await user.click(screen.getByRole("button", { name: "Close" }));

		expect(onClose).not.toHaveBeenCalled();
		expect(
			screen.getByRole("heading", { name: "Create job posting" }),
		).toBeVisible();
	});
});
