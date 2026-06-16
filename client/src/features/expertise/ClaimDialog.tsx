import { useEffect, useId, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ClaimType, TagVocabularyEntry } from "./types";

const TYPE_LABELS: Record<ClaimType, string> = {
	employment: "experience",
	education: "education",
	skill: "skill",
	project: "project",
	tag: "tag",
};

export interface ClaimDialogProps {
	type: ClaimType;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// Present = edit mode; the values prefill the form.
	prefill?: Record<string, unknown> | null;
	tagsVocab?: TagVocabularyEntry[];
	busy?: boolean;
	onSave: (body: Record<string, unknown>) => Promise<unknown>;
}

type FieldState = Record<string, string | boolean>;

function initialState(
	type: ClaimType,
	prefill?: Record<string, unknown> | null,
): FieldState {
	const get = (k: string) => {
		const v = prefill?.[k];
		return v === null || v === undefined ? "" : String(v);
	};
	switch (type) {
		case "employment":
			return {
				organization_name: get("organization_name"),
				title: get("title"),
				start_year: get("start_year"),
				end_year: get("end_year"),
				is_current: prefill?.is_current === true,
			};
		case "education":
			return {
				school_name: get("school_name"),
				degree: get("degree"),
				field: get("field"),
				start_year: get("start_year"),
				end_year: get("end_year"),
			};
		case "skill":
			return { skill_name: get("skill_name"), proficiency: get("proficiency") };
		case "project":
			return {
				project_name: get("project_name"),
				role: get("role"),
				url: get("url"),
				description: get("description"),
			};
		case "tag":
			return { tag: get("tag") };
	}
}

// Build the API body: trim strings, drop empties, coerce years to numbers.
function toBody(type: ClaimType, state: FieldState): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	const str = (k: string) => {
		const v = String(state[k] ?? "").trim();
		if (v) body[k] = v;
	};
	const year = (k: string) => {
		const v = String(state[k] ?? "").trim();
		if (v && /^\d{4}$/.test(v)) body[k] = Number(v);
	};
	if (type === "employment") {
		str("organization_name");
		str("title");
		year("start_year");
		year("end_year");
		body.is_current = state.is_current === true;
	} else if (type === "education") {
		str("school_name");
		str("degree");
		str("field");
		year("start_year");
		year("end_year");
	} else if (type === "skill") {
		str("skill_name");
		str("proficiency");
	} else if (type === "project") {
		str("project_name");
		str("role");
		str("url");
		str("description");
	} else if (type === "tag") {
		str("tag");
	}
	return body;
}

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
	const [state, setState] = useState<FieldState>(() =>
		initialState(type, prefill),
	);

	// Reset whenever the dialog opens (new add or a different claim to edit).
	useEffect(() => {
		if (open) setState(initialState(type, prefill));
	}, [open, type, prefill]);

	const set = (k: string, v: string | boolean) =>
		setState((s) => ({ ...s, [k]: v }));

	const handleSave = async () => {
		await onSave(toBody(type, state));
	};

	const label = TYPE_LABELS[type];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="capitalize">
						{isEdit ? `Edit ${label}` : `Add ${label}`}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Update the details for this entry."
							: "Add a self-reported entry to your expertise profile."}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-2">
					{type === "employment" && (
						<>
							<Field id={`${fieldId}-org`} label="Company / organization">
								<Input
									id={`${fieldId}-org`}
									value={String(state.organization_name)}
									onChange={(e) => set("organization_name", e.target.value)}
									placeholder="Google"
								/>
							</Field>
							<Field id={`${fieldId}-title`} label="Title">
								<Input
									id={`${fieldId}-title`}
									value={String(state.title)}
									onChange={(e) => set("title", e.target.value)}
									placeholder="Senior iOS Engineer"
								/>
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field id={`${fieldId}-start`} label="Start year">
									<Input
										id={`${fieldId}-start`}
										inputMode="numeric"
										value={String(state.start_year)}
										onChange={(e) => set("start_year", e.target.value)}
										placeholder="2019"
									/>
								</Field>
								<Field id={`${fieldId}-end`} label="End year">
									<Input
										id={`${fieldId}-end`}
										inputMode="numeric"
										value={String(state.end_year)}
										onChange={(e) => set("end_year", e.target.value)}
										placeholder="2023"
										disabled={state.is_current === true}
									/>
								</Field>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<Switch
									id={`${fieldId}-current`}
									checked={state.is_current === true}
									onCheckedChange={(c) => set("is_current", c)}
								/>
								<Label htmlFor={`${fieldId}-current`} className="font-normal">
									I currently work here
								</Label>
							</div>
						</>
					)}

					{type === "education" && (
						<>
							<Field id={`${fieldId}-school`} label="School / university">
								<Input
									id={`${fieldId}-school`}
									value={String(state.school_name)}
									onChange={(e) => set("school_name", e.target.value)}
									placeholder="Technical University of Munich"
								/>
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field id={`${fieldId}-degree`} label="Degree">
									<Input
										id={`${fieldId}-degree`}
										value={String(state.degree)}
										onChange={(e) => set("degree", e.target.value)}
										placeholder="MSc"
									/>
								</Field>
								<Field id={`${fieldId}-field`} label="Field of study">
									<Input
										id={`${fieldId}-field`}
										value={String(state.field)}
										onChange={(e) => set("field", e.target.value)}
										placeholder="Computer Science"
									/>
								</Field>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<Field id={`${fieldId}-estart`} label="Start year">
									<Input
										id={`${fieldId}-estart`}
										inputMode="numeric"
										value={String(state.start_year)}
										onChange={(e) => set("start_year", e.target.value)}
										placeholder="2018"
									/>
								</Field>
								<Field id={`${fieldId}-eend`} label="End year">
									<Input
										id={`${fieldId}-eend`}
										inputMode="numeric"
										value={String(state.end_year)}
										onChange={(e) => set("end_year", e.target.value)}
										placeholder="2021"
									/>
								</Field>
							</div>
						</>
					)}

					{type === "skill" && (
						<>
							<Field id={`${fieldId}-skill`} label="Skill">
								<Input
									id={`${fieldId}-skill`}
									value={String(state.skill_name)}
									onChange={(e) => set("skill_name", e.target.value)}
									placeholder="Swift"
								/>
							</Field>
							<Field id={`${fieldId}-prof`} label="Proficiency (optional)">
								<Select
									value={String(state.proficiency) || undefined}
									onValueChange={(v) => set("proficiency", v)}
								>
									<SelectTrigger id={`${fieldId}-prof`} className="w-full">
										<SelectValue placeholder="Select level" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="beginner">Beginner</SelectItem>
										<SelectItem value="intermediate">Intermediate</SelectItem>
										<SelectItem value="advanced">Advanced</SelectItem>
										<SelectItem value="expert">Expert</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</>
					)}

					{type === "project" && (
						<>
							<Field id={`${fieldId}-proj`} label="Project name">
								<Input
									id={`${fieldId}-proj`}
									value={String(state.project_name)}
									onChange={(e) => set("project_name", e.target.value)}
									placeholder="Open-source CLI tool"
								/>
							</Field>
							<Field id={`${fieldId}-role`} label="Your role (optional)">
								<Input
									id={`${fieldId}-role`}
									value={String(state.role)}
									onChange={(e) => set("role", e.target.value)}
									placeholder="Maintainer"
								/>
							</Field>
							<Field id={`${fieldId}-url`} label="URL (optional)">
								<Input
									id={`${fieldId}-url`}
									value={String(state.url)}
									onChange={(e) => set("url", e.target.value)}
									placeholder="https://github.com/…"
								/>
							</Field>
							<Field id={`${fieldId}-desc`} label="Description (optional)">
								<Textarea
									id={`${fieldId}-desc`}
									value={String(state.description)}
									onChange={(e) => set("description", e.target.value)}
									rows={3}
								/>
							</Field>
						</>
					)}

					{type === "tag" && (
						<Field id={`${fieldId}-tag`} label="Capability tag">
							<Select
								value={String(state.tag) || undefined}
								onValueChange={(v) => set("tag", v)}
								disabled={isEdit}
							>
								<SelectTrigger id={`${fieldId}-tag`} className="w-full">
									<SelectValue placeholder="Select a tag" />
								</SelectTrigger>
								<SelectContent>
									{(tagsVocab ?? []).map((t) => (
										<SelectItem key={t.tag} value={t.tag}>
											{t.label}
											{t.category ? ` · ${t.category}` : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
					>
						Cancel
					</Button>
					<Button type="button" onClick={handleSave} disabled={busy}>
						{isEdit ? "Save changes" : "Add"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Field({
	id,
	label,
	children,
}: {
	id: string;
	label: string;
	children: React.ReactNode;
}): JSX.Element {
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children}
		</div>
	);
}
