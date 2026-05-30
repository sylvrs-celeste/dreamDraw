import { useEffect, useState } from "react";

/** Column count for the current viewport.
 *
 *  matchMedia rather than a resize listener: it only fires when a breakpoint
 *  is actually crossed, instead of on every pixel of a drag.
 */
const BREAKPOINTS: [string, number][] = [
  ["(min-width: 1536px)", 4],
  ["(min-width: 1024px)", 3],
  ["(min-width: 640px)", 2],
];

function current(): number {
  if (typeof window === "undefined") return 1;
  for (const [query, count] of BREAKPOINTS) {
    if (window.matchMedia(query).matches) return count;
  }
  return 1;
}

export function useColumns(): number {
  const [columns, setColumns] = useState(current);

  useEffect(() => {
    const lists = BREAKPOINTS.map(([q]) => window.matchMedia(q));
    const update = () => setColumns(current());
    lists.forEach((l) => l.addEventListener("change", update));
    update();
    return () => lists.forEach((l) => l.removeEventListener("change", update));
  }, []);

  return columns;
}
