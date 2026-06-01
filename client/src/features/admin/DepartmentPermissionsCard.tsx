import {
	type DepartmentPermissionMap,
	PERMISSION_DETAILS,
	PERMISSIONS,
	type Permission,
} from "@member-manager/shared";
import {
	Box,
	Button,
	CardContent,
	Checkbox,
	CircularProgress,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tooltip,
	Typography,
} from "@mui/material";
import { type ReactElement, useMemo, useState } from "react";
import GlassCard from "../../components/ui/GlassCard";
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

	// Reseed the editable draft whenever the saved assignments change (initial
	// load or after a successful save), keyed on a stable serialization so we
	// don't clobber in-progress edits on unrelated re-renders. Using React's
	// render-time reset pattern instead of an effect avoids a render loop while
	// the query is still resolving (assignments is a fresh {} each render then).
	const baseline = useMemo(
		() => serializeAssignments(assignments),
		[assignments],
	);
	const [draft, setDraft] = useState<DepartmentPermissionMap>(assignments);
	const [seededBaseline, setSeededBaseline] = useState(baseline);
	if (baseline !== seededBaseline) {
		setSeededBaseline(baseline);
		setDraft(assignments);
	}

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
		<GlassCard sx={{ mb: 3 }}>
			<CardContent sx={{ p: 3 }}>
				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: { xs: "flex-start", sm: "center" },
						flexDirection: { xs: "column", sm: "row" },
						gap: 2,
						mb: 2,
					}}
				>
					<Box sx={{ maxWidth: 680 }}>
						<Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
							Department Tool Access
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Grant tools to entire departments. Every active member of a
							department automatically inherits the tools enabled here.
						</Typography>
					</Box>
					<Button
						type="button"
						variant="contained"
						onClick={handleSave}
						disabled={!isDirty || isSaving || isLoading}
					>
						{isSaving ? "Saving..." : "Save changes"}
					</Button>
				</Box>

				{isLoading ? (
					<Stack
						direction="row"
						spacing={1.5}
						alignItems="center"
						sx={{ py: 3 }}
					>
						<CircularProgress size={20} />
						<Typography color="text.secondary">
							Loading permissions...
						</Typography>
					</Stack>
				) : (
					<TableContainer>
						<Table size="small" aria-label="Department tool access matrix">
							<TableHead>
								<TableRow>
									<TableCell>Department</TableCell>
									{PERMISSIONS.map((permission) => (
										<TableCell key={permission} align="center">
											<Tooltip
												title={PERMISSION_DETAILS[permission].description}
											>
												<span>{PERMISSION_DETAILS[permission].label}</span>
											</Tooltip>
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{DEPARTMENTS.map((department) => {
									const granted = new Set(draft[department] ?? []);
									return (
										<TableRow key={department} hover>
											<TableCell component="th" scope="row">
												{department}
											</TableCell>
											{PERMISSIONS.map((permission) => (
												<TableCell key={permission} align="center">
													<Checkbox
														checked={granted.has(permission)}
														onChange={() =>
															togglePermission(department, permission)
														}
														disabled={isSaving}
														inputProps={{
															"aria-label": `${PERMISSION_DETAILS[permission].label} for ${department}`,
														}}
													/>
												</TableCell>
											))}
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</CardContent>
		</GlassCard>
	);
}
