import type { ReactNode } from "react";

/** Balanced masonry that keeps reading order.
 *
 *  CSS multi-column was the obvious choice and the wrong one. Columns fill
 *  top-to-bottom, so a list sorted by date ran *down* column one before
 *  starting column two -- the top row read May, Feb, Nov, Oct. On a gallery
 *  whose whole point is showing progress over time, the sequence has to read
 *  left to right.
 *
 *  So columns are assigned here instead: walk the items in order, drop each
 *  into whichever column is currently shortest. The first row comes out in
 *  order, and the bottoms stay roughly level.
 *
 *  Heights are estimated from the image aspect ratio rather than measured, so
 *  there is no layout thrash and no second render. The estimate only has to be
 *  good enough to balance -- being a few pixels out changes nothing visible.
 */

interface Props<T> {
  items: T[];
  columns: number;
  /** Rendered height relative to column width. Caption included by the caller. */
  ratio: (item: T) => number;
  children: (item: T) => ReactNode;
  keyOf: (item: T) => string;
}

export default function Masonry<T>({ items, columns, ratio, children, keyOf }: Props<T>) {
  const buckets: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);

  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < columns; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    buckets[shortest].push(item);
    heights[shortest] += ratio(item);
  }

  return (
    <div className="flex items-start gap-2">
      {buckets.map((bucket, i) => (
        <div key={i} className="min-w-0 flex-1">
          {bucket.map((item) => (
            <div key={keyOf(item)}>{children(item)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
