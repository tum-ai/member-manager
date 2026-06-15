import {
	type DepartmentPermissionMap,
	PERMISSION_DETAILS,
	PERMISSIONS,
	type Permission,
} from "@member-manager/shared";
import { type ReactElement, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import GlassCard from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "../../contexts/ToastContext";
import { useDepartmentPermissions } from "../../hooks/useDepartmentPermissions";
import { DEPARTMENTS } from "../../lib/constants";

// Canonical-order serialization so we can compare the working draft against the
// saved baseline regardless of how the permissions arrays happen to be ordered.
function serializeAssignments(assignments: DepartmentPermissionMap): string {
	const normalized: Record<string, Permission[]> = {};
	for (const department of [...DEPARTMENTS].sort()) {
		const granted = new Set(assignments[department] ?? []);
		const ordered = PERMISSIONS.filter((permission) => granted.has(permission));
		if (ordered.length > 0) {
			normalized[department] = ordered;
		}
	}
	return JSON.stringify(normalized);
}

export default function DepartmentPermissionsCard(): ReactElement {
	const { assignments, isLoading, saveAssignmentsAsync, isSaving } =
		useDepartmentPermissions();
	const { showToast } = useToast();

	const baseline = serializeAssignments(assignments);

	// Reseed the editable draft whenever the saved assignments change (initial
	// load or after a successful save). Keyed on and rebuilt from the canonical
	// `baseline` string rather than the object identity, so a refetch that
	// returns equivalent data with a fresh reference doesn't clobber edits.
	const [draft, setDraft] = useState<DepartmentPermissionMap>(assignments);
	useEffect(() => {
		setDraft(JSON.parse(baseline) as DepartmentPermissionMap);
	}, [baseline]);

	const isDirty = serializeAssignments(draft) !== baseline;

	function togglePermission(department: string, permission: Permission): void {
		setDraft((current) => {
			const granted = new Set(current[department] ?? []);
			if (granted.has(permission)) {
				granted.delete(permission);
			} else {
				granted.add(permission);
			}
			return {
				...current,
				[department]: PERMISSIONS.filter((value) => granted.has(value)),
			};
		});
	}

	async function handleSave(): Promise<void> {
		try {
			await saveAssignmentsAsync(draft);
			showToast("Department permissions saved.", "success");
		} catch {
			showToast("Failed to save department permissions.", "error");
		}
	}

	return (
		<GlassCard className="mb-6">
			<div className="p-6">
				<div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
					<div className="max-w-[680px]">
						<h2 className="mb-0.5 text-lg font-semibold">
							Department Tool Access
						</h2>
						<p className="text-sm text-muted-foreground">
							Grant tools to entire departments. Every active member of a
							department automatically inherits the tools enabled here.
						</p>
					</div>
					<Button
						type="button"
						onClick={handleSave}
						disabled={!isDirty || isSaving || isLoading}
					>
						{isSaving ? "Saving..." : "Save changes"}
					</Button>
				</div>

				{isLoading ? (
					<div className="flex flex-row items-center gap-3 py-6">
						<Spinner className="size-5" />
						<span className="text-muted-foreground">
							Loading permissions...
						</span>
					</div>
				) : (
					<div className="overflow-x-auto rounded-md border">
						<Table aria-label="Department tool access matrix">
							<TableHeader>
								<TableRow>
									<TableHead>Department</TableHead>
									{PERMISSIONS.map((permission) => (
										<TableHead key={permission} className="text-center">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<span>{PERMISSION_DETAILS[permission].label}</span>
													</TooltipTrigger>
													<TooltipContent>
														{PERMISSION_DETAILS[permission].description}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{DEPARTMENTS.map((department) => {
									const granted = new Set(draft[department] ?? []);
									return (
										<TableRow key={department}>
											<TableHead
												scope="row"
												className="h-auto py-2 font-normal"
											>
												{department}
											</TableHead>
											{PERMISSIONS.map((permission) => (
												<TableCell key={permission} className="text-center">
													<div className="flex justify-center">
														<Checkbox
															checked={granted.has(permission)}
															onCheckedChange={() =>
																togglePermission(department, permission)
															}
															disabled={isSaving}
															aria-label={`${PERMISSION_DETAILS[permission].label} for ${department}`}
														/>
													</div>
												</TableCell>
											))}
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</GlassCard>
	);
}
