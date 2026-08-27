import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import { rotationFor } from "../theme/rotation";
import type { EntrySummary } from "../api/types";

/** Room for the rotated corners to swing into.
 *
 *  A card tilted by t degrees needs roughly h*sin(t)/2 of extra space each
 *  side. At 3.5 degrees on a tall card that is around 20px. Without it the
 *  corners clip into whatever sits alongside.
 */
const SWING = "px-5 py-4";

function formatArtDate(iso: string): string {
  // Split rather than new Date(iso): an ISO date with no timezone is read as
  // UTC and renders as the previous day west of Greenwich.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export default function Polaroid({ entry }: { entry: EntrySummary }) {
  const cover = entry.cover_image;
  // Feeds the .polaroid rule in index.css. Every transform lives there so
  // nothing competes for the property on hover.
  const tilt = { "--tilt": `${rotationFor(entry.id)}deg` } as CSSProperties;

  return (
    <div className={SWING}>
      <Link
        to={`/e/${entry.slug}`}
        aria-label={`${entry.title}, ${formatArtDate(entry.art_date)}`}
        style={tilt}
        className="polaroid group block origin-center rounded-[2px] bg-stock p-3 pb-0
                   text-ink shadow-polaroid hover:shadow-polaroid-lift
                   focus-visible:shadow-polaroid-lift"
      >
        {cover ? (
          <img
            src={cover.url_thumb}
            alt={cover.alt_text ?? ""}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            style={{ aspectRatio: `${cover.width} / ${cover.height}` }}
            className="block w-full bg-well/40 object-cover brightness-95
                       transition-[filter] duration-300 group-hover:brightness-100
                       group-focus-visible:brightness-100"
          />
        ) : (
          <div
            className="grid aspect-4/3 w-full place-items-center bg-well/30 text-xs text-ink/60"
            aria-hidden="true"
          >
            no image yet
          </div>
        )}

        {/* Weighted bottom lip -- deeper than the other three sides, which is
            what reads as a polaroid rather than a framed print. */}
        <figcaption className="flex items-baseline justify-between gap-3 px-1 py-3.5">
          <span className="font-hand text-lg leading-none">{entry.title}</span>
          <span className="shrink-0 text-[0.65rem] tracking-wide text-ink/65 uppercase">
            {formatArtDate(entry.art_date)}
          </span>
        </figcaption>
      </Link>
    </div>
  );
}
