import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { accentFor } from "../theme/rotation";
import { api } from "../api/client";
import type { EntrySummary } from "../api/types";

/** One fetch rather than paging. A personal gallery is dozens of entries, and
 *  a timeline is only legible if the whole span is on the page at once. If it
 *  ever outgrows this the fix is paging by year, not infinite scroll. */
const LIMIT = 100;

interface MonthGroup {
  key: string;
  label: string;
  entries: EntrySummary[];
}

interface YearGroup {
  year: string;
  count: number;
  months: MonthGroup[];
}

function group(entries: EntrySummary[]): YearGroup[] {
  const years = new Map<string, Map<string, EntrySummary[]>>();

  for (const e of entries) {
    // Split the ISO string rather than parsing a Date: an ISO date with no
    // timezone is read as UTC and can land in the previous month.
    const [y, m] = e.art_date.split("-");
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y)!;
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(e);
  }

  return [...years.entries()].map(([year, months]) => ({
    year,
    count: [...months.values()].reduce((n, list) => n + list.length, 0),
    months: [...months.entries()].map(([m, list]) => ({
      key: `${year}-${m}`,
      label: new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(undefined, {
        month: "long",
      }),
      entries: list,
    })),
  }));
}

const RAIL: Record<string, string> = {
  amber: "bg-accent-amber",
  rust: "bg-accent-rust",
  teal: "bg-accent-teal",
};

export default function Timeline() {
  const [params, setParams] = useSearchParams();
  // Newest first, matching the gallery. Reading the journey from the start is
  // one click away via the toggle.
  const sort = params.get("sort") === "asc" ? "asc" : "desc";

  const entries = useQuery({
    queryKey: ["timeline", sort],
    queryFn: () => api.listEntries({ sort, perPage: LIMIT }),
  });

  const years = group(entries.data?.items ?? []);

  return (
    <section aria-labelledby="timeline-heading">
      <div className="mb-10 flex items-baseline justify-between gap-4">
        <h1 id="timeline-heading" className="font-hand text-4xl text-stock">
          The journey
        </h1>
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("sort", sort === "asc" ? "desc" : "asc");
            setParams(next, { replace: true });
          }}
          className="text-xs text-stock/55 underline underline-offset-4 hover:text-stock/85"
        >
          {sort === "asc" ? "From the start" : "Most recent first"}
        </button>
      </div>

      {entries.isPending && <p className="text-stock/60">Loading…</p>}

      {!entries.isPending && years.length === 0 && (
        <p className="py-16 text-center text-stock/60">Nothing on the timeline yet.</p>
      )}

      {years.map((y) => (
        <section key={y.year} className="mb-4">
          <div className="flex items-baseline gap-4">
            <h2 className="font-hand text-3xl text-stock/90">{y.year}</h2>
            <span className="text-xs tracking-wide text-stock/55 uppercase">
              {y.count} {y.count === 1 ? "piece" : "pieces"}
            </span>
          </div>

          {y.months.map((month) => (
            <div key={month.key} className="relative pt-6 pb-2 pl-6">
              {/* The rail: a hairline down the left with a node at each month.
                  Colour comes from the same hash the tag chips use, so a given
                  month keeps its colour between visits. */}
              <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 left-[3px] w-px bg-stock/12"
              />
              <span
                aria-hidden="true"
                className={`absolute top-[1.85rem] left-0 h-[7px] w-[7px] rounded-full ${
                  RAIL[accentFor(month.key)]
                }`}
              />

              <h3 className="text-xs tracking-[0.18em] text-stock/60 uppercase">
                {month.label}
              </h3>

              {/* Capped width: left to fill a 2560px screen the day number ends
                  up a foot away from the title it belongs to. */}
              <ul className="mt-3 max-w-2xl space-y-1">
                {month.entries.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/e/${e.slug}`}
                      className="group flex items-center gap-4 rounded-sm py-2
                                 transition-colors hover:bg-surface/50"
                    >
                      {e.cover_image ? (
                        <img
                          src={e.cover_image.url_thumb}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-sm bg-well/40 object-cover"
                        />
                      ) : (
                        <span className="h-14 w-14 shrink-0 rounded-sm bg-well/50" />
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-hand text-lg text-stock/85 group-hover:text-stock">
                          {e.title}
                        </span>
                        {e.tags.length > 0 && (
                          <span className="block truncate text-xs text-stock/55">
                            {e.tags.map((t) => t.name).join(" · ")}
                          </span>
                        )}
                      </span>

                      <span className="shrink-0 text-xs text-stock/55 tabular-nums">
                        {e.art_date.slice(8)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}
