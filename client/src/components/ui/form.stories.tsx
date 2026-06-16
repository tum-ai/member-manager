import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "react-hook-form";
import { Button } from "./button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "./form";
import { Input } from "./input";

type ProfileValues = {
	username: string;
	email: string;
};

const meta = {
	title: "UI/Form",
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Profile: Story = {
	render: () => {
		const form = useForm<ProfileValues>({
			defaultValues: { username: "", email: "" },
		});

		const onSubmit = (values: ProfileValues) => {
			console.log(values);
		};

		return (
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="w-80 space-y-6">
					<FormField
						control={form.control}
						name="username"
						rules={{ required: "Username is required." }}
						render={({ field }) => (
							<FormItem>
								<FormLabel>Username</FormLabel>
								<FormControl>
									<Input placeholder="ada" {...field} />
								</FormControl>
								<FormDescription>
									This is your public display name.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="email"
						rules={{
							required: "Email is required.",
							pattern: {
								value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
								message: "Enter a valid email address.",
							},
						}}
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input type="email" placeholder="ada@tum.ai" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button type="submit">Save profile</Button>
				</form>
			</Form>
		);
	},
};
