import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
	title: "UI/Tabs",
	component: Tabs,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Tabs defaultValue="profile" className="w-80">
			<TabsList>
				<TabsTrigger value="profile">Profile</TabsTrigger>
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="notifications">Notifications</TabsTrigger>
			</TabsList>
			<TabsContent value="profile" className="text-sm text-muted-foreground">
				Manage your public profile and display name.
			</TabsContent>
			<TabsContent value="account" className="text-sm text-muted-foreground">
				Update your email address and password.
			</TabsContent>
			<TabsContent
				value="notifications"
				className="text-sm text-muted-foreground"
			>
				Choose how and when you want to be notified.
			</TabsContent>
		</Tabs>
	),
};

export const LineVariant: Story = {
	render: () => (
		<Tabs defaultValue="profile" className="w-80">
			<TabsList variant="line">
				<TabsTrigger value="profile">Profile</TabsTrigger>
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="notifications">Notifications</TabsTrigger>
			</TabsList>
			<TabsContent value="profile" className="text-sm text-muted-foreground">
				Manage your public profile and display name.
			</TabsContent>
			<TabsContent value="account" className="text-sm text-muted-foreground">
				Update your email address and password.
			</TabsContent>
			<TabsContent
				value="notifications"
				className="text-sm text-muted-foreground"
			>
				Choose how and when you want to be notified.
			</TabsContent>
		</Tabs>
	),
};

export const Vertical: Story = {
	render: () => (
		<Tabs
			defaultValue="profile"
			orientation="vertical"
			className="w-[28rem] flex-row"
		>
			<TabsList>
				<TabsTrigger value="profile">Profile</TabsTrigger>
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="notifications">Notifications</TabsTrigger>
			</TabsList>
			<TabsContent value="profile" className="text-sm text-muted-foreground">
				Manage your public profile and display name.
			</TabsContent>
			<TabsContent value="account" className="text-sm text-muted-foreground">
				Update your email address and password.
			</TabsContent>
			<TabsContent
				value="notifications"
				className="text-sm text-muted-foreground"
			>
				Choose how and when you want to be notified.
			</TabsContent>
		</Tabs>
	),
};
