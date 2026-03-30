import SearchIcon from "@mui/icons-material/Search";
import {
	Avatar,
	Box,
	CardContent,
	Chip,
	CircularProgress,
	Grid,
	InputAdornment,
	TextField,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

import GlassCard from "../../components/ui/GlassCard";
import { useMembersListData } from "../../hooks/useMembersListData";
import type { Member } from "../../types";

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase();
}

function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 45%, 45%)`;
}

export default function MemberList() {
	const { members, isLoading, error } = useMembersListData();
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		if (!members) return [];
		if (!search.trim()) return members;
		const q = search.toLowerCase();
		return members.filter((m) => {
			const name = `${m.given_name} ${m.surname}`.toLowerCase();
			const dept = (m.department || "").toLowerCase();
			const role = (m.member_role || "").toLowerCase();
			const batch = (m.batch || "").toLowerCase();
			const degree = (m.degree || "").toLowerCase();
			const school = (m.school || "").toLowerCase();
			const skills = (m.skills || []).join(" ").toLowerCase();
			return (
				name.includes(q) ||
				dept.includes(q) ||
				role.includes(q) ||
				batch.includes(q) ||
				degree.includes(q) ||
				school.includes(q) ||
				skills.includes(q)
			);
		});
	}, [members, search]);

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "60vh",
					gap: 2,
				}}
			>
				<CircularProgress size={24} />
				<Typography color="text.secondary">Loading members...</Typography>
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ textAlign: "center", py: 8 }}>
				<Typography color="error">
					Failed to load members. Please try again later.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ py: 2 }}>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					mb: 4,
					flexWrap: "wrap",
					gap: 2,
				}}
			>
				<Box>
					<Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
						All Members
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Browse the active network and search across member profiles
					</Typography>
				</Box>
				<TextField
					size="small"
					placeholder="Search members..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					slotProps={{
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon fontSize="small" />
								</InputAdornment>
							),
						},
					}}
					sx={{ minWidth: 260 }}
				/>
			</Box>

			{filtered.length === 0 ? (
				<Box sx={{ textAlign: "center", py: 8 }}>
					<Typography color="text.secondary">
						{search ? "No members match your search." : "No members found."}
					</Typography>
				</Box>
			) : (
				<Grid container spacing={2}>
					{filtered.map((member) => (
						<Grid key={member.user_id} size={{ xs: 12, sm: 6, md: 4 }}>
							<MemberCard member={member} />
						</Grid>
					))}
				</Grid>
			)}
		</Box>
	);
}

interface MemberCardProps {
	member: Member;
}

function MemberCard({ member }: MemberCardProps) {
	const fullName = `${member.given_name} ${member.surname}`.trim();

	return (
		<GlassCard>
			<CardContent sx={{ p: 2.5 }}>
				<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
					<Avatar
						src={member.profile_picture_url || undefined}
						sx={{
							width: 56,
							height: 56,
							bgcolor: stringToColor(fullName || member.email),
							fontSize: 20,
							fontWeight: 600,
							flexShrink: 0,
						}}
					>
						{getInitials(member)}
					</Avatar>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography
							variant="subtitle1"
							sx={{
								fontWeight: 600,
								lineHeight: 1.3,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{fullName || "Unnamed Member"}
						</Typography>

						{member.member_role && (
							<Typography
								variant="body2"
								color="primary"
								sx={{ lineHeight: 1.4 }}
							>
								{member.member_role}
							</Typography>
						)}

						{member.department && (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ lineHeight: 1.4 }}
							>
								{member.department}
							</Typography>
						)}
					</Box>
				</Box>

				<Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
					{member.batch && (
						<Chip label={member.batch} size="small" variant="outlined" />
					)}
					{member.degree && (
						<Chip label={member.degree} size="small" variant="outlined" />
					)}
					{member.school && (
						<Chip
							label={member.school}
							size="small"
							variant="outlined"
							sx={{
								maxWidth: "100%",
								"& .MuiChip-label": {
									overflow: "hidden",
									textOverflow: "ellipsis",
								},
							}}
						/>
					)}
				</Box>

				{member.skills && member.skills.length > 0 && (
					<Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
						{member.skills.slice(0, 5).map((skill, index) => (
							<Chip
								key={`${index}-${skill}`}
								label={skill}
								size="small"
								color="primary"
								variant="outlined"
								sx={{ fontSize: "0.7rem", height: 22 }}
							/>
						))}
						{member.skills.length > 5 && (
							<Chip
								label={`+${member.skills.length - 5}`}
								size="small"
								sx={{ fontSize: "0.7rem", height: 22 }}
							/>
						)}
					</Box>
				)}
			</CardContent>
		</GlassCard>
	);
}
