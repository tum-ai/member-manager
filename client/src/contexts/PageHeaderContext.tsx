import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { createPortal } from "react-dom";

interface PageHeaderData {
	title: string;
	description?: string;
}

interface PageHeaderContextValue {
	header: PageHeaderData | null;
	setHeader: (header: PageHeaderData | null) => void;
	actionsSlot: HTMLElement | null;
	setActionsSlot: (el: HTMLElement | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

/**
 * Holds the current page's header so the sticky top app bar can render it. Pages
 * declare their header with `useSetPageHeader`; the bar (in MainLayout) reads it.
 * One header zone instead of a redundant in-content title under an empty bar.
 */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
	const [header, setHeader] = useState<PageHeaderData | null>(null);
	const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
	const value = useMemo(
		() => ({ header, setHeader, actionsSlot, setActionsSlot }),
		[header, actionsSlot],
	);
	return (
		<PageHeaderContext.Provider value={value}>
			{children}
		</PageHeaderContext.Provider>
	);
}

const noop = () => {};

/** The current page header, for the app bar to render. */
export function usePageHeader(): PageHeaderData | null {
	return useContext(PageHeaderContext)?.header ?? null;
}

/** Bar-side slot wiring (the app bar registers its actions container here). */
export function usePageHeaderSlots(): Pick<
	PageHeaderContextValue,
	"actionsSlot" | "setActionsSlot"
> {
	const ctx = useContext(PageHeaderContext);
	return {
		actionsSlot: ctx?.actionsSlot ?? null,
		setActionsSlot: ctx?.setActionsSlot ?? noop,
	};
}

/**
 * Declare the current route's header. The title (and optional description) render
 * in the sticky top app bar; the header clears when the page unmounts. A no-op
 * when rendered outside a provider (e.g. an isolated test or story).
 */
export function useSetPageHeader(title: string, description?: string): void {
	const setHeader = useContext(PageHeaderContext)?.setHeader;
	useEffect(() => {
		if (!setHeader) return;
		setHeader({ title, description });
		return () => setHeader(null);
	}, [title, description, setHeader]);
}

/**
 * Render page-level actions (buttons, filters) into the right side of the app
 * bar. Place anywhere in a page's tree; it portals into the bar. Outside a
 * provider it falls back to rendering inline.
 */
export function PageHeaderActions({
	children,
}: {
	children: ReactNode;
}): ReactNode {
	const ctx = useContext(PageHeaderContext);
	if (!ctx) return children;
	if (!ctx.actionsSlot) return null;
	return createPortal(children, ctx.actionsSlot);
}
