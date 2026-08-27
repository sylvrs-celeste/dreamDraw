import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../api/client";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

export default function Home() {
  // Just for the count on the button. A failure here should leave the page
  // perfectly usable, so nothing branches on the error.
  //
  // Key must not collide with the gallery's. That one is a useInfiniteQuery
  // storing {pages, pageParams}; this is a plain useQuery storing an
  // EntryPage. Sharing a key means whichever mounts second reads the other's
  // shape and blows up on the difference.
  const entries = useQuery({
    queryKey: ["entries-count"],
    queryFn: () => api.listEntries({ perPage: 1 }),
  });

  const total = entries.data?.total;

  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center py-16">
      <p className="text-sm tracking-[0.2em] text-stock/40 uppercase">{greeting()}</p>

      <h1 className="mt-4 font-hand text-5xl leading-tight text-stock sm:text-6xl">
        Welcome back.
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-stock/70">
        So — what have you drawn?
      </p>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-stock/45">
        Everything you have made so far is pinned up in the studio. Add to it, or
        just go and look at how far it has come.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link
          to="/gallery"
          className="rounded-full bg-stock px-6 py-3 text-sm font-medium text-canvas
                     transition-transform duration-200 hover:-translate-y-0.5
                     focus-visible:-translate-y-0.5 motion-reduce:transform-none"
        >
          See the wall
          {total !== undefined && (
            <span className="ml-2 opacity-50">
              {total} {total === 1 ? "piece" : "pieces"}
            </span>
          )}
        </Link>

        <Link
          to="/timeline"
          className="text-sm text-stock/55 underline underline-offset-4 hover:text-stock/85"
        >
          Or follow it by date
        </Link>
      </div>
    </section>
  );
}
