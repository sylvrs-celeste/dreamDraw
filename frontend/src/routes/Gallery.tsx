import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import Masonry from "../components/Masonry";
import { useColumns } from "../components/useColumns";
import Polaroid from "../components/Polaroid";
import TagFilter from "../components/TagFilter";
import { api } from "../api/client";

const PER_PAGE = 24;

export default function Gallery() {
  // The filter lives in the URL so a filtered view can be linked and survives
  // a reload or a back button.
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag");
  const sort = params.get("sort") === "asc" ? "asc" : "desc";

  const columns = useColumns();
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });

  const entries = useInfiniteQuery({
    queryKey: ["entries", { tag, sort }],
    queryFn: ({ pageParam }) =>
      api.listEntries({ tag: tag ?? undefined, sort, page: pageParam, perPage: PER_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_next ? last.page + 1 : undefined),
  });

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = entries;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;

    // rootMargin starts the next page while the sentinel is still a screen
    // away, so scrolling does not stall waiting on the request.
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setTag = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("tag", slug);
    else next.delete("tag");
    setParams(next, { replace: true });
  };

  const toggleSort = () => {
    const next = new URLSearchParams(params);
    next.set("sort", sort === "desc" ? "asc" : "desc");
    setParams(next, { replace: true });
  };

  // ?.pages is guarded as well as keyed uniquely: if a key ever collides
  // with a plain useQuery again, this degrades to an empty gallery rather
  // than throwing into the error boundary.
  const items = entries.data?.pages?.flatMap((p) => p.items) ?? [];
  const total = entries.data?.pages?.[0]?.total ?? 0;

  return (
    <section aria-labelledby="gallery-heading">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 id="gallery-heading" className="sr-only">
          Gallery
        </h1>
        <p className="text-xs tracking-wide text-stock/45 uppercase">
          {entries.isPending ? " " : `${total} ${total === 1 ? "piece" : "pieces"}`}
        </p>
        <button
          type="button"
          onClick={toggleSort}
          className="text-xs text-stock/55 underline underline-offset-4 hover:text-stock/85"
        >
          {sort === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {tags.data && <TagFilter tags={tags.data} active={tag} onChange={setTag} />}

      {entries.isPending && <p className="text-stock/50">Loading…</p>}

      {entries.isError && (
        <p className="text-accent-rust">
          Could not load the gallery. {(entries.error as Error).message}
        </p>
      )}

      {!entries.isPending && !entries.isError && items.length === 0 && (
        <p className="py-16 text-center text-stock/45">
          {tag ? "Nothing tagged that yet." : "No entries yet."}
        </p>
      )}

      <Masonry
        items={items}
        columns={columns}
        keyOf={(e) => e.id}
        /* Rendered height as a multiple of column width.
           Not simply the image ratio: the image sits inside the swing padding
           and the card border, so it is about 0.83 of the column wide, and the
           caption lip adds a roughly fixed 0.24. Fitted against measured
           layouts -- a flat "+ caption" constant left the columns hundreds of
           pixels out of step on portrait images. */
        ratio={(e) =>
          0.83 * (e.cover_image ? e.cover_image.height / e.cover_image.width : 0.75) +
          0.24
        }
      >
        {(entry) => <Polaroid entry={entry} />}
      </Masonry>

      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {isFetchingNextPage && (
        <p className="py-8 text-center text-sm text-stock/45">Loading more…</p>
      )}
    </section>
  );
}
