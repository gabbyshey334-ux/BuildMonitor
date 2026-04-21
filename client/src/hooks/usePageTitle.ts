import { useEffect } from "react";

const BASE_TITLE = "JengaTrack";

/**
 * Dynamically updates the document title as "Page | JengaTrack".
 * If `title` is empty/undefined, it resets to the base title.
 *
 * Usage:
 *   usePageTitle("Dashboard");      // → "Dashboard | JengaTrack"
 *   usePageTitle();                 // → "JengaTrack — Site Management"
 */
export function usePageTitle(title?: string | null): void {
  useEffect(() => {
    const previous = document.title;
    if (title && title.trim().length > 0) {
      document.title = `${title} | ${BASE_TITLE}`;
    } else {
      document.title = `${BASE_TITLE} — Site Management`;
    }
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default usePageTitle;
