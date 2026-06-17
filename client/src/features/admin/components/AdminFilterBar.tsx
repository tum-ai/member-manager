import { Download, Mail, Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ACTIVE_FILTER_OPTIONS,
	type AdminFilters,
	BOOLEAN_FILTER_OPTIONS,
} from "@/features/admin/adminUtils";
import { FilterSelect } from "./FilterSelect";

interface AdminFilterBarProps {
	filters: AdminFilters;
	setFilters: Dispatch<SetStateAction<AdminFilters>>;
	canExport: boolean;
	onExportCsv: () => void;
	onExportExcel: () => void;
	onDownloadEmails: () => void;
}

export function AdminFilterBar({
	filters,
	setFilters,
	canExport,
	onExportCsv,
	onExportExcel,
	onDownloadEmails,
}: AdminFilterBarProps) {
	return (
		<GlassCard className="mb-6">
			<div className="p-6">
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
					<div className="lg:col-span-5">
						<div className="grid gap-1.5">
							<Label htmlFor="admin-search">Search members</Label>
							<div className="relative">
								<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="admin-search"
									className="pl-9"
									placeholder="Name, email, phone, IBAN, department..."
									value={filters.search}
									onChange={(event) =>
										setFilters((currentValue) => ({
											...currentValue,
											search: event.target.value,
										}))
									}
								/>
							</div>
						</div>
					</div>

					<FilterSelect
						className="sm:col-span-4 lg:col-span-2"
						label="SEPA mandate"
						value={filters.mandateAgreed}
						onValueChange={(value) =>
							setFilters((currentValue) => ({
								...currentValue,
								mandateAgreed: value,
							}))
						}
						options={BOOLEAN_FILTER_OPTIONS}
					/>

					<FilterSelect
						className="sm:col-span-4 lg:col-span-2"
						label="Data privacy"
						value={filters.dataPrivacyNoticeAgreed}
						onValueChange={(value) =>
							setFilters((currentValue) => ({
								...currentValue,
								dataPrivacyNoticeAgreed: value,
							}))
						}
						options={BOOLEAN_FILTER_OPTIONS}
					/>

					<FilterSelect
						className="sm:col-span-4 lg:col-span-2"
						label="Privacy policy"
						value={filters.privacyAgreed}
						onValueChange={(value) =>
							setFilters((currentValue) => ({
								...currentValue,
								privacyAgreed: value,
							}))
						}
						options={BOOLEAN_FILTER_OPTIONS}
					/>

					<FilterSelect
						className="sm:col-span-4 lg:col-span-2"
						label="Member state"
						value={filters.active}
						onValueChange={(value) =>
							setFilters((currentValue) => ({
								...currentValue,
								active: value,
							}))
						}
						options={ACTIVE_FILTER_OPTIONS}
					/>
				</div>

				<div className="mt-6 flex flex-col justify-between gap-3 md:flex-row">
					<div />

					<div className="flex flex-col gap-3 sm:flex-row">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" disabled={!canExport}>
									<Download className="size-4" />
									Export
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="min-w-[180px]">
								<DropdownMenuItem onSelect={() => onExportCsv()}>
									Export as CSV
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => onExportExcel()}>
									Export as Excel
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Button
							type="button"
							variant="outline"
							onClick={onDownloadEmails}
							disabled={!canExport}
						>
							<Mail className="size-4" />
							Download emails
						</Button>
					</div>
				</div>
			</div>
		</GlassCard>
	);
}
