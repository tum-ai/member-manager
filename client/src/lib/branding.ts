export type TumAiLogoBackground = "light" | "dark";

export function getTumAiLogoPath(background: TumAiLogoBackground): string {
	return background === "light"
		? "/img/logo_purple.svg"
		: "/img/tum_ai_logo_new.svg";
}
