import type { ContractTemplate } from "@member-manager/shared";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TemplateListItem({
	template,
	selected,
	onSelect,
	onDelete,
}: {
	template: ContractTemplate;
	selected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}): JSX.Element {
	return (
		<div
			className={cn(
				"flex w-full items-center gap-2 rounded-md hover:bg-accent hover:text-accent-foreground",
				selected ? "bg-accent text-accent-foreground" : "",
			)}
		>
			<button
				type="button"
				onClick={onSelect}
				aria-pressed={selected}
				className="flex-1 px-3 py-2 text-left"
			>
				<span className="block text-sm">{template.name}</span>
				<span className="block text-xs text-muted-foreground">
					{template.is_active ? "active" : "inactive"}
				</span>
			</button>
			<Button
				variant="ghost"
				size="icon-sm"
				className="mr-1"
				aria-label={`Delete template ${template.name}`}
				onClick={onDelete}
			>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}

export function NewTemplateDialog({
	open,
	onClose,
	onCreate,
	submitting,
	error,
}: {
	open: boolean;
	onClose: () => void;
	onCreate: (name: string) => void;
	submitting: boolean;
	error: Error | null;
}): JSX.Element {
	const [name, setName] = useState("");
	useEffect(() => {
		if (!open) setName("");
	}, [open]);
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>New Template</DialogTitle>
					<DialogDescription className="sr-only">
						Create a contract template by entering its name.
					</DialogDescription>
				</DialogHeader>
				<Field label="Name" htmlFor="new-template-name">
					<Input
						id="new-template-name"
						autoFocus
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || submitting}
						onClick={() => onCreate(name.trim())}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
