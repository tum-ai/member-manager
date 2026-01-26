import { useEffect, useState } from "react";
import { apiClient } from "../../lib/apiClient";

interface Member {
	id: string;
	name: string;
	email: string;
	// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
	[key: string]: any;
}

export default function MemberList() {
	const [members, setMembers] = useState<Member[]>([]);

	useEffect(() => {
		const fetchMembers = async () => {
			try {
				const data = await apiClient<Member[]>("/api/admin/members");
				console.log("Fetched members:", data);
				if (data) setMembers(data);
			} catch (error) {
				console.error("Error fetching members:", error);
			}
		};
		fetchMembers();
	}, []);

	return (
		<div>
			<h2 className="text-xl font-semibold mb-2">Current Members</h2>
			<ul className="space-y-1">
				{members.map((m) => (
					<li key={m.id} className="border p-2 rounded">
						{m.name} – {m.email}
					</li>
				))}
			</ul>
		</div>
	);
}
