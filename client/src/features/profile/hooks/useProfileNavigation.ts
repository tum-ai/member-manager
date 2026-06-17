import type React from "react";
import { useEffect, useState } from "react";
import type { NavItem } from "../profileTypes";

interface UseProfileNavigationResult {
	activeSection: string;
	navItems: NavItem[];
	handleNavClick: (
		event: React.MouseEvent<HTMLAnchorElement>,
		id: string,
	) => void;
}

export function useProfileNavigation({
	isLoading,
	isAdmin,
}: {
	isLoading: boolean;
	isAdmin: boolean;
}): UseProfileNavigationResult {
	const [activeSection, setActiveSection] = useState("personal");

	// Highlight the sidebar nav link for whichever section is currently in view.
	useEffect(() => {
		if (isLoading) return;
		const ids = [
			"personal",
			"tumai",
			"links",
			"cv",
			"banking",
			...(isAdmin ? [] : ["requests"]),
		];

		let frame = 0;
		const update = () => {
			frame = 0;
			// Active = the last section whose top has crossed a trigger line. Each
			// section owns the line for a scroll range equal to its height, so even
			// short sections become active. Near the page bottom the line slides
			// toward the viewport bottom so short trailing sections still get a turn.
			const viewportHeight = window.innerHeight;
			const maxScroll = document.documentElement.scrollHeight - viewportHeight;
			const remaining = maxScroll - window.scrollY;
			const ratio =
				maxScroll <= 0
					? 1
					: Math.min(Math.max(remaining / viewportHeight, 0), 1);
			const baseLine = viewportHeight * 0.25;
			const triggerLine = baseLine + (viewportHeight - baseLine) * (1 - ratio);

			let current = ids[0];
			for (const id of ids) {
				const element = document.getElementById(id);
				if (element && element.getBoundingClientRect().top <= triggerLine) {
					current = id;
				}
			}
			setActiveSection(current);
		};
		const onScroll = () => {
			if (frame) return;
			frame = window.requestAnimationFrame(update);
		};

		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [isLoading, isAdmin]);

	const handleNavClick = (
		event: React.MouseEvent<HTMLAnchorElement>,
		id: string,
	) => {
		event.preventDefault();
		document
			.getElementById(id)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const navItems: NavItem[] = [
		{ id: "personal", label: "Personal information" },
		{ id: "tumai", label: "TUM.ai profile" },
		{ id: "links", label: "LinkedIn & location" },
		{ id: "cv", label: "CV" },
		{ id: "banking", label: "Banking & agreements" },
		...(isAdmin ? [] : [{ id: "requests", label: "Request changes" }]),
	];

	return { activeSection, navItems, handleNavClick };
}
