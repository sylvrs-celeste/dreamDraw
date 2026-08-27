import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import Lightbox from "../components/Lightbox";
import TagChip from "../components/TagChip";
import { api } from "../api/client";
import { rotationFor } from "../theme/rotation";
import type { CSSProperties } from "react";

function formatArtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function EntryDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [open, setOpen] = useState<number | null>(null);

  const entry = useQuery({
    queryKey: ["entry", slug],
    queryFn: () => api.getEntry(slug),
    retry: false,
  });

  if (entry.isPending) {
    return <p className="py-24 text-center text-stock/50">Loading…</p>;
  }

  if (entry.isError || !entry.data) {
    return (
      <section className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <h1 className="font-hand text-4xl text-stock">Not found</h1>
        <p className="mt-3 text-stock/60">No entry with that address.</p>
        <Link to="/gallery" className="mt-8 text-sm underline underline-offset-4">
          Back to the wall
        </Link>
      </section>
    );
  }

  const e = entry.data;

  return (
    <article className="pb-16">
      <header className="mx-auto max-w-3xl pt-4 pb-12">
        <p className="text-xs tracking-[0.2em] text-stock/40 uppercase">
          {formatArtDate(e.art_date)}
        </p>
        <h1 className="mt-3 font-hand text-4xl text-stock sm:text-5xl">{e.title}</h1>

        {e.description && (
          <p className="mt-6 max-w-prose leading-relaxed text-stock/70">{e.description}</p>
        )}

        {e.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {e.tags.map((t) => (
              <Link key={t.id} to={`/gallery?tag=${encodeURIComponent(t.slug)}`}>
                <TagChip slug={t.slug} name={t.name} />
              </Link>
            ))}
          </div>
        )}
      </header>

      {e.images.length === 0 ? (
        <p className="py-16 text-center text-stock/45">No images on this entry yet.</p>
      ) : (
        /* items-start, or grid stretches every card to the tallest in its row
           and leaves dead stock below the caption. */
        <div className="mx-auto grid max-w-6xl items-start gap-8 sm:grid-cols-2">
          {e.images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open image ${i + 1} of ${e.images.length}`}
              /* Same hashed tilt as the wall, seeded off the image id so the
                 two views agree and a card does not jump when you arrive. */
              style={{ "--tilt": `${rotationFor(img.id)}deg` } as CSSProperties}
              className="polaroid block bg-stock p-3 pb-0 shadow-polaroid
                         hover:shadow-polaroid-lift focus-visible:shadow-polaroid-lift"
            >
              <img
                /* medium, not thumb: these plates render around 560px wide and
                   the 400px thumb visibly upscales. Thumb is for the wall. */
                src={img.url_medium}
                alt={img.alt_text ?? ""}
                width={img.width}
                height={img.height}
                loading="lazy"
                decoding="async"
                style={{ aspectRatio: `${img.width} / ${img.height}` }}
                className="block w-full object-cover"
              />
              <figcaption className="px-1 py-3.5 text-left font-hand text-base text-ink">
                {img.alt_text || `Plate ${i + 1}`}
              </figcaption>
            </button>
          ))}
        </div>
      )}

      <nav
        aria-label="Other entries"
        className="mx-auto mt-16 flex max-w-3xl items-center justify-between gap-4 border-t border-stock/10 pt-8 text-sm"
      >
        {e.newer_slug ? (
          <Link to={`/e/${e.newer_slug}`} className="text-stock/60 hover:text-stock">
            ← Newer
          </Link>
        ) : (
          <span className="text-stock/20">← Newer</span>
        )}

        <Link to="/gallery" className="text-stock/45 underline underline-offset-4 hover:text-stock">
          Back to Gallery
        </Link>

        {e.older_slug ? (
          <Link to={`/e/${e.older_slug}`} className="text-stock/60 hover:text-stock">
            Older →
          </Link>
        ) : (
          <span className="text-stock/20">Older →</span>
        )}
      </nav>

      {open !== null && (
        <Lightbox
          images={e.images}
          index={open}
          onClose={() => setOpen(null)}
          onIndexChange={setOpen}
        />
      )}
    </article>
  );
}
