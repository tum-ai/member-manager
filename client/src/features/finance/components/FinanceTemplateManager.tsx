import { zodResolver } from "@hookform/resolvers/zod";
import {
	type FinancePlanTemplate,
	type FinancePlanTemplateCreate,
	FinancePlanTemplateCreateSchema,
	type FinancePlanTemplateItemCreate,
	FinancePlanTemplateItemCreateSchema,
	type FinanceTaxArea,
} from "@member-manager/shared";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	FINANCE_BEREICH_OPTIONS,
	formatBereichLabel,
	formatFinanceAmount,
} from "@/features/finance/financeUtils";
import type {
	DeleteTemplateItemInput,
	TemplateItemMutationInput,
} from "@/features/finance/hooks/useFinanceManagement";

const NO_TAX_AREA = "none";

interface FinanceTemplateManagerProps {
	templates: FinancePlanTemplate[];
	canManage: boolean;
	isCreatingTemplate: boolean;
	pendingTemplateItemId: string | null;
	deletingTemplateItemId: string | null;
	onCreateTemplate: (input: FinancePlanTemplateCreate) => Promise<void>;
	onCreateTemplateItem: (input: TemplateItemMutationInput) => Promise<void>;
	onDeleteTemplateItem: (input: DeleteTemplateItemInput) => Promise<void>;
}

export function FinanceTemplateManager({
	templates,
	canManage,
	isCreatingTemplate,
	pendingTemplateItemId,
	deletingTemplateItemId,
	onCreateTemplate,
	onCreateTemplateItem,
	onDeleteTemplateItem,
}: FinanceTemplateManagerProps): ReactElement {
	return (
		<section
			aria-labelledby="finance-template-heading"
			className="rounded-md border bg-card p-4 shadow-sm"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 id="finance-template-heading" className="text-sm font-semibold">
						Planvorlagen
					</h3>
				</div>
				{canManage ? (
					<TemplateCreateForm
						isPending={isCreatingTemplate}
						onCreate={onCreateTemplate}
					/>
				) : null}
			</div>

			{templates.length === 0 ? (
				<p className="mt-4 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
					Noch keine Planvorlagen vorhanden.
				</p>
			) : (
				<Accordion type="multiple" className="mt-3">
					{templates.map((template) => (
						<AccordionItem key={template.id} value={template.id}>
							<AccordionTrigger>
								<span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
									<span className="truncate">{template.name}</span>
									<Badge variant={template.is_active ? "success" : "neutral"}>
										{template.is_active ? "Aktiv" : "Inaktiv"}
									</Badge>
									<span className="text-xs font-normal text-muted-foreground">
										{formatBereichLabel(template.tax_area)} ·{" "}
										{template.items.length} Position(en)
									</span>
								</span>
							</AccordionTrigger>
							<AccordionContent>
								{template.description ? (
									<p className="mb-3 text-sm text-muted-foreground">
										{template.description}
									</p>
								) : null}
								<div className="overflow-x-auto">
									<table className="w-full min-w-[620px] text-sm">
										<thead>
											<tr className="border-b text-left text-xs text-muted-foreground">
												<th className="px-2 py-2 font-medium">Position</th>
												<th className="px-2 py-2 font-medium">Kategorie</th>
												<th className="px-2 py-2 font-medium">Richtung</th>
												<th className="px-2 py-2 font-medium">Monat</th>
												<th className="px-2 py-2 text-right font-medium">
													Betrag
												</th>
												{canManage ? (
													<th className="w-10 px-2 py-2">
														<span className="sr-only">Aktionen</span>
													</th>
												) : null}
											</tr>
										</thead>
										<tbody>
											{template.items.map((item) => (
												<tr key={item.id} className="border-b last:border-b-0">
													<td className="px-2 py-2 font-medium">
														{item.label}
													</td>
													<td className="px-2 py-2">{item.category ?? "—"}</td>
													<td className="px-2 py-2">
														{item.direction === "income"
															? "Einnahme"
															: "Ausgabe"}
													</td>
													<td className="px-2 py-2">
														{item.expected_month ?? "—"}
													</td>
													<td className="px-2 py-2 text-right tabular-nums">
														{formatFinanceAmount(item.planned_amount)}
													</td>
													{canManage ? (
														<td className="px-2 py-2">
															<Button
																type="button"
																variant="ghost"
																size="icon-xs"
																disabled={deletingTemplateItemId === item.id}
																aria-label={`Vorlagenposition ${item.label} löschen`}
																onClick={() => {
																	void onDeleteTemplateItem({
																		templateId: template.id,
																		itemId: item.id,
																	});
																}}
															>
																{deletingTemplateItemId === item.id ? (
																	<Loader2 className="animate-spin" />
																) : (
																	<Trash2 />
																)}
															</Button>
														</td>
													) : null}
												</tr>
											))}
										</tbody>
									</table>
								</div>
								{canManage ? (
									<TemplateItemCreateForm
										templateId={template.id}
										isPending={pendingTemplateItemId === template.id}
										onCreate={onCreateTemplateItem}
									/>
								) : null}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			)}
		</section>
	);
}

function TemplateCreateForm({
	isPending,
	onCreate,
}: {
	isPending: boolean;
	onCreate: (input: FinancePlanTemplateCreate) => Promise<void>;
}): ReactElement {
	const form = useForm<FinancePlanTemplateCreate>({
		resolver: zodResolver(FinancePlanTemplateCreateSchema),
		defaultValues: {
			name: "",
			description: "",
			tax_area: null,
			is_active: true,
		},
	});

	async function submit(values: FinancePlanTemplateCreate): Promise<void> {
		const succeeded = await onCreate({
			...values,
			description: values.description?.trim() || null,
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset({
				name: "",
				description: "",
				tax_area: null,
				is_active: true,
			});
		}
	}

	return (
		<form
			className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(10rem,1fr)_12rem_auto] lg:w-auto"
			onSubmit={form.handleSubmit(submit)}
		>
			<Field
				label="Neue Vorlage"
				htmlFor="finance-template-name"
				error={form.formState.errors.name?.message}
			>
				<Input
					id="finance-template-name"
					placeholder="Event-Basis"
					{...form.register("name")}
				/>
			</Field>
			<Field label="Steuerbereich" htmlFor="finance-template-tax-area">
				<Controller
					control={form.control}
					name="tax_area"
					render={({ field }) => (
						<Select
							value={field.value ?? NO_TAX_AREA}
							onValueChange={(value) =>
								field.onChange(
									value === NO_TAX_AREA ? null : (value as FinanceTaxArea),
								)
							}
						>
							<SelectTrigger
								id="finance-template-tax-area"
								aria-label="Vorlagen-Steuerbereich"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_TAX_AREA}>Ohne Bereich</SelectItem>
								{FINANCE_BEREICH_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</Field>
			<div className="flex items-end">
				<Button
					type="submit"
					size="sm"
					disabled={isPending}
					className="w-full bg-[#9A64D9] text-white hover:bg-[#523573]"
				>
					{isPending ? <Loader2 className="animate-spin" /> : <Plus />}
					Anlegen
				</Button>
			</div>
		</form>
	);
}

function TemplateItemCreateForm({
	templateId,
	isPending,
	onCreate,
}: {
	templateId: string;
	isPending: boolean;
	onCreate: (input: TemplateItemMutationInput) => Promise<void>;
}): ReactElement {
	const form = useForm<FinancePlanTemplateItemCreate>({
		resolver: zodResolver(FinancePlanTemplateItemCreateSchema),
		defaultValues: {
			label: "",
			category: null,
			direction: "expense",
			planned_amount: 0,
			expected_month: null,
			note: null,
			sort_order: 0,
		},
	});

	async function submit(item: FinancePlanTemplateItemCreate): Promise<void> {
		const succeeded = await onCreate({
			templateId,
			item: {
				...item,
				category: item.category?.trim() || null,
				note: item.note?.trim() || null,
			},
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			form.reset({
				label: "",
				category: null,
				direction: "expense",
				planned_amount: 0,
				expected_month: null,
				note: null,
				sort_order: 0,
			});
		}
	}

	return (
		<form
			className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto]"
			onSubmit={form.handleSubmit(submit)}
		>
			<Field
				label="Position"
				htmlFor={`template-item-label-${templateId}`}
				error={form.formState.errors.label?.message}
			>
				<Input
					id={`template-item-label-${templateId}`}
					placeholder="Venue"
					{...form.register("label")}
				/>
			</Field>
			<Field label="Richtung" htmlFor={`template-item-direction-${templateId}`}>
				<Controller
					control={form.control}
					name="direction"
					render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}>
							<SelectTrigger id={`template-item-direction-${templateId}`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="expense">Ausgabe</SelectItem>
								<SelectItem value="income">Einnahme</SelectItem>
							</SelectContent>
						</Select>
					)}
				/>
			</Field>
			<Field
				label="Kategorie"
				htmlFor={`template-item-category-${templateId}`}
				error={form.formState.errors.category?.message}
			>
				<Controller
					control={form.control}
					name="category"
					render={({ field }) => (
						<Input
							id={`template-item-category-${templateId}`}
							placeholder="Location"
							value={field.value ?? ""}
							onChange={(event) => field.onChange(event.target.value || null)}
						/>
					)}
				/>
			</Field>
			<Field
				label="Betrag (€)"
				htmlFor={`template-item-amount-${templateId}`}
				error={form.formState.errors.planned_amount?.message}
			>
				<Input
					id={`template-item-amount-${templateId}`}
					type="number"
					min={0}
					step="0.01"
					inputMode="decimal"
					className="text-right tabular-nums"
					{...form.register("planned_amount", { valueAsNumber: true })}
				/>
			</Field>
			<Field
				label="Monat"
				htmlFor={`template-item-month-${templateId}`}
				error={form.formState.errors.expected_month?.message}
			>
				<Controller
					control={form.control}
					name="expected_month"
					render={({ field }) => (
						<Input
							id={`template-item-month-${templateId}`}
							type="month"
							value={field.value ?? ""}
							onChange={(event) => field.onChange(event.target.value || null)}
						/>
					)}
				/>
			</Field>
			<div className="flex items-end">
				<Button type="submit" size="sm" disabled={isPending} className="w-full">
					{isPending ? <Loader2 className="animate-spin" /> : <Plus />}
					Position
				</Button>
			</div>
		</form>
	);
}
