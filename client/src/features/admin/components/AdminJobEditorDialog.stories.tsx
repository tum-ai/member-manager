import { zodResolver } from "@hookform/resolvers/zod";
import {
	type JobPostingFormInput,
	type JobPostingInput,
	jobPostingInputSchema,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "react-hook-form";
import { expect, userEvent, within } from "storybook/test";
import { emptyAdminJobForm } from "@/features/admin/adminJobRequestsUtils";
import { AdminJobEditorDialog } from "./AdminJobEditorDialog";

function AdminJobEditorDialogStory() {
	const form = useForm<JobPostingFormInput, unknown, JobPostingInput>({
		resolver: zodResolver(jobPostingInputSchema),
		defaultValues: emptyAdminJobForm,
	});

	return (
		<AdminJobEditorDialog
			mode="create"
			form={form}
			isSaving={false}
			onClose={() => {}}
			onSubmit={form.handleSubmit(() => {})}
		/>
	);
}

const meta = {
	title: "Admin/Job Editor Dialog",
	component: AdminJobEditorDialogStory,
} satisfies Meta<typeof AdminJobEditorDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateJob: Story = {
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		const title = body.getByLabelText(/job title/i);
		await userEvent.type(title, "AI Platform Engineer");
		await expect(title).toHaveValue("AI Platform Engineer");
		await expect(
			body.getByRole("button", { name: "Publish job" }),
		).toBeEnabled();
	},
};
