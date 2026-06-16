import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	CalendarIcon,
	CreditCardIcon,
	SettingsIcon,
	SmileIcon,
	UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "./command";

const meta = {
	title: "UI/Command",
	component: Command,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Command>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Command className="w-[28rem] rounded-lg border shadow-md">
			<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				<CommandGroup heading="Suggestions">
					<CommandItem>
						<CalendarIcon />
						<span>Calendar</span>
					</CommandItem>
					<CommandItem>
						<SmileIcon />
						<span>Search Emoji</span>
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Settings">
					<CommandItem>
						<UserIcon />
						<span>Profile</span>
						<CommandShortcut>⌘P</CommandShortcut>
					</CommandItem>
					<CommandItem>
						<CreditCardIcon />
						<span>Billing</span>
						<CommandShortcut>⌘B</CommandShortcut>
					</CommandItem>
					<CommandItem>
						<SettingsIcon />
						<span>Settings</span>
						<CommandShortcut>⌘S</CommandShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	),
};

export const Dialog: Story = {
	render: () => {
		const [open, setOpen] = useState(false);

		useEffect(() => {
			const down = (e: KeyboardEvent) => {
				if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					setOpen((prev) => !prev);
				}
			};
			document.addEventListener("keydown", down);
			return () => document.removeEventListener("keydown", down);
		}, []);

		return (
			<div className="flex flex-col items-center gap-3">
				<Button variant="outline" onClick={() => setOpen(true)}>
					Open command palette
				</Button>
				<p className="text-sm text-muted-foreground">
					Or press <kbd>⌘K</kbd>
				</p>
				<CommandDialog open={open} onOpenChange={setOpen}>
					<CommandInput placeholder="Type a command or search..." />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Suggestions">
							<CommandItem>
								<CalendarIcon />
								<span>Calendar</span>
							</CommandItem>
							<CommandItem>
								<SmileIcon />
								<span>Search Emoji</span>
							</CommandItem>
							<CommandItem>
								<SettingsIcon />
								<span>Settings</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</CommandDialog>
			</div>
		);
	},
};
