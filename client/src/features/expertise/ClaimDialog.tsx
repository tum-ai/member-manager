import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ClaimFieldInput,
	type ClaimType,
	claimFieldSchemas,
	type TagVocabularyEntry,
} from "@member-manager/shared";
import { useEffect, useId } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const TYPE_LABELS: Record<ClaimType, string> = {
	employment: "experience",
	education: "education",
	skill: "skill",
	project: "project",
	tag: "capability",
};

/** Form-only superset; the selected shared schema strips fields for other claim kinds. */
interface ClaimFormValues {
	organization_name?: string;
	title?: string;
	start_year?: number;
	end_year?: number;
	is_current?: boolean;
	school_name?: string;
	degree?: string;
	field?: string;
	skill_name?: string;
	proficiency?: "beginner" | "intermediate" | "advanced" | "expert";
	project_name?: string;
	role?: string;
	url?: string;
	description?: string;
	tag?: string;
}

export interface ClaimDialogProps {
	type: ClaimType;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prefill?: Record<string, unknown> | null;
	tagsVocab?: TagVocabularyEntry[];
	busy?: boolean;
	onSave: (body: ClaimFieldInput) => Promise<unknown>;
}

function textValue(
	prefill: Record<string, unknown> | null | undefined,
	key: string,
) {
	const value = prefill?.[key];
	return typeof value === "string" ? value : "";
}

function yearValue(
	prefill: Record<string, unknown> | null | undefined,
	key: string,
) {
	const value = prefill?.[key];
	return typeof value === "number" ? value : undefined;
}

function defaultValues(
	prefill?: Record<string, unknown> | null,
): ClaimFormValues {
	const proficiency = prefill?.proficiency;
	return {
		organization_name: textValue(prefill, "organization_name"),
		title: textValue(prefill, "title"),
		start_year: yearValue(prefill, "start_year"),
		end_year: yearValue(prefill, "end_year"),
		is_current: prefill?.is_current === true,
		school_name: textValue(prefill, "school_name"),
		degree: textValue(prefill, "degree"),
		field: textValue(prefill, "field"),
		skill_name: textValue(prefill, "skill_name"),
		proficiency:
			proficiency === "beginner" ||
			proficiency === "intermediate" ||
			proficiency === "advanced" ||
			proficiency === "expert"
				? proficiency
				: undefined,
		project_name: textValue(prefill, "project_name"),
		role: textValue(prefill, "role"),
		url: textValue(prefill, "url"),
		description: textValue(prefill, "description"),
		tag: textValue(prefill, "tag"),
	};
}

/** Shared-schema-backed add/edit dialog for every Beacon claim kind. */
export function ClaimDialog({
	type,
	open,
	onOpenChange,
	prefill,
	tagsVocab,
	busy,
	onSave,
}: ClaimDialogProps): JSX.Element {
	const fieldId = useId();
	const isEdit = Boolean(prefill);
	const form = useForm<ClaimFormValues>({
		resolver: zodResolver(claimFieldSchemas[type]) as Resolver<ClaimFormValues>,
		defaultValues: defaultValues(prefill),
	});
	useEffect(() => {
		if (open) form.reset(defaultValues(prefill));
	}, [form, open, prefill]);
	const current = form.watch("is_current");
	const primaryValue = form.watch(
		type === "employment"
			? "organization_name"
			: type === "education"
				? "school_name"
				: type === "skill"
					? "skill_name"
					: type === "project"
						? "project_name"
						: "tag",
	);
	const submit = form.handleSubmit(async (values) => {
		const parsed = claimFieldSchemas[type].parse(values) as ClaimFieldInput;
		await onSave(parsed);
	});

	const field = (
		name: keyof ClaimFormValues,
		label: string,
		input: JSX.Element,
	) => (
		<div className="grid gap-1.5">
			<Label htmlFor={`${fieldId}-${name}`}>{label}</Label>
			{input}
			{form.formState.errors[name]?.message ? (
				<p className="text-sm text-destructive" role="alert">
					{form.formState.errors[name]?.message}
				</p>
			) : null}
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
				<form onSubmit={submit}>
					<DialogHeader>
						<DialogTitle className="capitalize">
							{isEdit
								? `Edit ${TYPE_LABELS[type]}`
								: `Add ${TYPE_LABELS[type]}`}
						</DialogTitle>
						<DialogDescription>
							{isEdit
								? "Update this profile entry."
								: "Add a self-reported, confirmed profile entry."}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-5">
						{type === "employment" ? (
							<>
								{field(
									"organization_name",
									"Company or organization",
									<Input
										id={`${fieldId}-organization_name`}
										{...form.register("organization_name")}
										placeholder="Google"
									/>,
								)}
								{field(
									"title",
									"Title",
									<Input
										id={`${fieldId}-title`}
										{...form.register("title")}
										placeholder="Senior iOS Engineer"
									/>,
								)}
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{field(
										"start_year",
										"Start year",
										<Input
											id={`${fieldId}-start_year`}
											type="number"
											inputMode="numeric"
											{...form.register("start_year", {
												setValueAs: (value) =>
													value === "" ? undefined : Number(value),
											})}
										/>,
									)}
									{field(
										"end_year",
										"End year",
										<Input
											id={`${fieldId}-end_year`}
											type="number"
											inputMode="numeric"
											disabled={current}
											{...form.register("end_year", {
												setValueAs: (value) =>
													value === "" ? undefined : Number(value),
											})}
										/>,
									)}
								</div>
								<Controller
									control={form.control}
									name="is_current"
									render={({ field: controller }) => (
										<div className="flex items-center gap-2 text-sm">
											<Switch
												id={`${fieldId}-is_current`}
												checked={controller.value ?? false}
												onCheckedChange={controller.onChange}
											/>
											<Label
												htmlFor={`${fieldId}-is_current`}
												className="font-normal"
											>
												I currently work here
											</Label>
										</div>
									)}
								/>
							</>
						) : null}
						{type === "education" ? (
							<>
								{field(
									"school_name",
									"School or university",
									<Input
										id={`${fieldId}-school_name`}
										{...form.register("school_name")}
										placeholder="Technical University of Munich"
									/>,
								)}
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{field(
										"degree",
										"Degree",
										<Input
											id={`${fieldId}-degree`}
											{...form.register("degree")}
											placeholder="MSc"
										/>,
									)}
									{field(
										"field",
										"Field of study",
										<Input
											id={`${fieldId}-field`}
											{...form.register("field")}
											placeholder="Computer Science"
										/>,
									)}
								</div>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{field(
										"start_year",
										"Start year",
										<Input
											id={`${fieldId}-start_year`}
											type="number"
											{...form.register("start_year", {
												setValueAs: (value) =>
													value === "" ? undefined : Number(value),
											})}
										/>,
									)}
									{field(
										"end_year",
										"End year",
										<Input
											id={`${fieldId}-end_year`}
											type="number"
											{...form.register("end_year", {
												setValueAs: (value) =>
													value === "" ? undefined : Number(value),
											})}
										/>,
									)}
								</div>
							</>
						) : null}
						{type === "skill" ? (
							<>
								{field(
									"skill_name",
									"Skill",
									<Input
										id={`${fieldId}-skill_name`}
										{...form.register("skill_name")}
										placeholder="Swift"
									/>,
								)}
								<Controller
									control={form.control}
									name="proficiency"
									render={({ field: controller }) =>
										field(
											"proficiency",
											"Proficiency (optional)",
											<Select
												value={controller.value}
												onValueChange={controller.onChange}
											>
												<SelectTrigger
													id={`${fieldId}-proficiency`}
													className="w-full"
												>
													<SelectValue placeholder="Select level" />
												</SelectTrigger>
												<SelectContent>
													{[
														"beginner",
														"intermediate",
														"advanced",
														"expert",
													].map((level) => (
														<SelectItem
															key={level}
															value={level}
															className="capitalize"
														>
															{level}
														</SelectItem>
													))}
												</SelectContent>
											</Select>,
										)
									}
								/>
							</>
						) : null}
						{type === "project" ? (
							<>
								{field(
									"project_name",
									"Project name",
									<Input
										id={`${fieldId}-project_name`}
										{...form.register("project_name")}
										placeholder="Open-source CLI tool"
									/>,
								)}
								{field(
									"role",
									"Your role (optional)",
									<Input
										id={`${fieldId}-role`}
										{...form.register("role")}
										placeholder="Maintainer"
									/>,
								)}
								{field(
									"url",
									"URL (optional)",
									<Input
										id={`${fieldId}-url`}
										type="url"
										{...form.register("url")}
										placeholder="https://github.com/…"
									/>,
								)}
								{field(
									"description",
									"Description (optional)",
									<Textarea
										id={`${fieldId}-description`}
										{...form.register("description")}
										rows={3}
									/>,
								)}
							</>
						) : null}
						{type === "tag" ? (
							<Controller
								control={form.control}
								name="tag"
								render={({ field: controller }) =>
									field(
										"tag",
										"Capability",
										<Select
											value={controller.value}
											onValueChange={controller.onChange}
											disabled={isEdit}
										>
											<SelectTrigger id={`${fieldId}-tag`} className="w-full">
												<SelectValue placeholder="Select a capability" />
											</SelectTrigger>
											<SelectContent>
												{(tagsVocab ?? []).map((tag) => (
													<SelectItem key={tag.tag} value={tag.tag}>
														{tag.label}
														{tag.category ? ` · ${tag.category}` : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>,
									)
								}
							/>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={busy}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={busy || !String(primaryValue ?? "").trim()}
						>
							{busy ? <Spinner className="size-4" /> : null}
							{isEdit ? "Save changes" : "Add"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
