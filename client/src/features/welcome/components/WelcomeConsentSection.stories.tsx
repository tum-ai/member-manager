import type { MemberConsentsInput } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { WelcomeConsentSection } from "./WelcomeConsentSection";

const nothingGranted: MemberConsentsInput = {
	privacy_policy_agreed: false,
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: false,
};

// Stateful wrapper so the checkboxes respond like they do on the page.
function InteractiveSection(
	args: ComponentProps<typeof WelcomeConsentSection>,
) {
	const [draft, setDraft] = useState(args.draft);
	const [isDirty, setIsDirty] = useState(false);
	return (
		<WelcomeConsentSection
			{...args}
			draft={draft}
			isDirty={isDirty}
			onConsentChange={(field, value) => {
				args.onConsentChange(field, value);
				setDraft((current) => ({ ...current, [field]: value }));
				setIsDirty(true);
			}}
			onAgreeToAll={() => {
				args.onAgreeToAll();
				setDraft({
					privacy_policy_agreed: true,
					website_profile_consent: true,
					event_photos_consent: true,
					partner_sharing_consent: true,
				});
				setIsDirty(true);
			}}
		/>
	);
}

const meta = {
	title: "Features/Welcome/WelcomeConsentSection",
	component: WelcomeConsentSection,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		draft: nothingGranted,
		onConsentChange: fn(),
		onAgreeToAll: fn(),
		onSave: fn(),
		isSaving: false,
		isDirty: false,
		isDecided: false,
	},
	render: (args) => (
		<div className="w-[40rem] max-w-full">
			<InteractiveSection {...args} />
		</div>
	),
} satisfies Meta<typeof WelcomeConsentSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Undecided: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const partner = canvas.getByRole("checkbox", { name: /sharing my data/i });
		await expect(partner).not.toBeChecked();
		// Saving needs the Privacy Policy / Data Privacy Notice acknowledgement.
		await expect(
			canvas.getByRole("button", { name: "Save my choices" }),
		).toBeDisabled();

		await userEvent.click(partner);
		await expect(partner).toBeChecked();
		await expect(args.onConsentChange).toHaveBeenLastCalledWith(
			"partner_sharing_consent",
			true,
		);

		await userEvent.click(canvas.getByRole("button", { name: "Agree to all" }));
		for (const box of canvas.getAllByRole("checkbox")) {
			await expect(box).toBeChecked();
		}
		await expect(
			canvas.getByRole("button", { name: "Agree to all" }),
		).toBeDisabled();

		await userEvent.click(
			canvas.getByRole("button", { name: "Save my choices" }),
		);
		await expect(args.onSave).toHaveBeenCalledOnce();
	},
};

export const OpensFullText: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Data Privacy Notice" }),
		);
		const dialog = within(document.body).getByRole("dialog", {
			name: "Data Privacy Notice",
		});
		// Read-only: the dialog lists the statements without its own checkboxes.
		await expect(within(dialog).queryAllByRole("checkbox")).toHaveLength(0);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Close" }),
		);
	},
};

export const Decided: Story = {
	args: {
		draft: {
			privacy_policy_agreed: true,
			website_profile_consent: false,
			event_photos_consent: false,
			partner_sharing_consent: true,
		},
		isDecided: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Choices saved" }),
		).toBeDisabled();
	},
};

export const Saving: Story = {
	args: { isSaving: true, isDirty: true },
};
