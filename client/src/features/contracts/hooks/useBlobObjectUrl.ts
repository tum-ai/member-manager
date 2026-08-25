import { useEffect, useState } from "react";

export function useBlobObjectUrl(blob: Blob | undefined): string | null {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!blob) {
			setUrl(null);
			return;
		}

		const nextUrl = window.URL.createObjectURL(blob);
		setUrl(nextUrl);
		return () => window.URL.revokeObjectURL(nextUrl);
	}, [blob]);

	return url;
}
