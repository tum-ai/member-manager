import type {
	ContractReviewStatus,
	ContractStatusEvent,
	ContractSubmission,
} from "@member-manager/shared";
import { CONTRACT_ADDONS, CONTRACT_PACKAGES } from "@member-manager/shared";
import {
	AlignLeft,
	Building2,
	Calendar,
	Hash,
	Info,
	type LucideIcon,
	Mail,
	MapPin,
	Package,
	User,
} from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	CONTRACT_MANUAL_STATUSES,
	getContractStatusLabel,
	getContractStatusTone,
} from "@/features/contracts/contractStatus";
import { ContractStatusTimeline } from "./ContractStatusTimeline";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function humanizeKey(key: string): string {
	return key
		.replace(/_/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase())
		.replace(/\bTumai\b/g, "TUM.ai")
		.replace(/\bIban\b/g, "IBAN")
		.replace(/\bUrl\b/g, "URL")
		.replace(/\bId\b/g, "ID");
}

function fieldIcon(key: string): LucideIcon {
	const normalizedKey = key.toLowerCase();
	if (normalizedKey.includes("date")) return Calendar;
	if (normalizedKey.includes("email")) return Mail;
	if (normalizedKey.includes("package") || normalizedKey.includes("addon"))
		return Package;
	if (normalizedKey.includes("address")) return MapPin;
	if (normalizedKey.includes("company")) return Building2;
	if (
		normalizedKey.includes("description") ||
		normalizedKey.includes("terms") ||
		normalizedKey.includes("notes")
	)
		return AlignLeft;
	if (
		normalizedKey.includes("name") ||
		normalizedKey.includes("signer") ||
		normalizedKey.includes("representative") ||
		normalizedKey.includes("contact")
	)
		return User;
	if (
		normalizedKey.includes("amount") ||
		normalizedKey.includes("number") ||
		normalizedKey.includes("count")
	)
		return Hash;
	return Info;
}

function mapOptionLabel(option: string): string {
	return (
		CONTRACT_PACKAGES[option]?.label ?? CONTRACT_ADDONS[option]?.label ?? option
	);
}

function formatIsoDate(value: string): string {
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function renderFieldValue(key: string, value: unknown): React.ReactNode {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	const normalizedKey = key.toLowerCase();
	if (Array.isArray(value)) {
		return value.length > 0
			? value.map((entry) => mapOptionLabel(String(entry))).join(", ")
			: "—";
	}
	if (typeof value === "object") return JSON.stringify(value);
	const stringValue = String(value);
	if (normalizedKey.includes("email")) {
		return (
			<LinkButton asChild>
				<a href={`mailto:${stringValue}`}>{stringValue}</a>
			</LinkButton>
		);
	}
	if (normalizedKey.includes("date") && ISO_DATE.test(stringValue))
		return formatIsoDate(stringValue);
	if (normalizedKey.includes("package") || normalizedKey.includes("addon"))
		return mapOptionLabel(stringValue);
	return stringValue;
}

export function ContractSubmissionStatusSection({
	submission,
	statusEvents,
	statusEventsLoading,
	isContractsAdmin,
	busy,
	onManualStatusChange,
}: {
	submission: ContractSubmission;
	statusEvents: ContractStatusEvent[];
	statusEventsLoading: boolean;
	isContractsAdmin: boolean;
	busy: boolean;
	onManualStatusChange: (status: ContractReviewStatus) => void;
}): JSX.Element {
	const canSetManualStatus = CONTRACT_MANUAL_STATUSES.includes(
		submission.status as (typeof CONTRACT_MANUAL_STATUSES)[number],
	);

	return (
		<div className="mb-6 flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-sm text-muted-foreground">Status</span>
				<Badge variant={getContractStatusTone(submission.status)}>
					{getContractStatusLabel(submission.status)}
				</Badge>
				{isContractsAdmin && canSetManualStatus ? (
					<div className="flex items-center gap-2 sm:ml-auto">
						<Label
							htmlFor="manual-status"
							className="text-sm text-muted-foreground"
						>
							Set status manually
						</Label>
						<Select
							value={submission.status}
							onValueChange={(status) => {
								if (status !== submission.status) {
									onManualStatusChange(status as ContractReviewStatus);
								}
							}}
							disabled={busy}
						>
							<SelectTrigger
								id="manual-status"
								className="w-44"
								aria-label="Set status manually"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CONTRACT_MANUAL_STATUSES.map((status) => (
									<SelectItem key={status} value={status}>
										{getContractStatusLabel(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
			</div>
			{statusEvents.length > 0 ? (
				<GlassCard className="p-4">
					<p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Status history
					</p>
					<ContractStatusTimeline
						events={statusEvents}
						loading={statusEventsLoading}
					/>
				</GlassCard>
			) : null}
		</div>
	);
}

export function ContractSubmissionFormDataSection({
	submission,
	formEntries,
}: {
	submission: ContractSubmission;
	formEntries: [string, unknown][];
}): JSX.Element {
	return (
		<GlassCard className="p-6">
			<p className="mb-3 text-base font-medium">Form data</p>
			{formEntries.length > 0 ? (
				<dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
					{formEntries.map(([key, value]) => {
						const Icon = fieldIcon(key);
						return (
							<div key={key} className="flex items-start gap-3">
								<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<dt className="text-xs text-muted-foreground">
										{humanizeKey(key)}
									</dt>
									<dd className="break-words text-sm">
										{renderFieldValue(key, value)}
									</dd>
								</div>
							</div>
						);
					})}
				</dl>
			) : (
				<p className="text-sm text-muted-foreground">No form data.</p>
			)}
			<Collapsible className="mt-4">
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="sm">
						Show raw JSON
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[13px]">
						{JSON.stringify(submission.form_data, null, 2)}
					</pre>
				</CollapsibleContent>
			</Collapsible>
		</GlassCard>
	);
}
