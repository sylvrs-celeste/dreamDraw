import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../../api/client";

export default function AdminIndex() {
  const entries = useQuery({
    queryKey: ["admin-entries"],
    queryFn: () => api.listEntries({ perPage: 100 }),
  });

  return (
    <section>
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-hand text-4xl text-stock">Studio</h1>
        <Link
          to="/admin/new"
          className="rounded-full bg-stock px-5 py-2.5 text-sm font-medium text-canvas"
        >
          New entry
        </Link>
      </div>

      {entries.isPending && <p className="text-stock/45">Loading…</p>}

      {entries.data?.items.length === 0 && (
        <p className="py-16 text-center text-stock/45">
          Nothing yet. Start with the first piece.
        </p>
      )}

      <ul className="divide-y divide-stock/10">
        {entries.data?.items.map((e) => (
          <li key={e.id}>
            <Link
              to={`/admin/e/${e.slug}`}
              className="flex items-center gap-4 py-3 hover:bg-surface/40"
            >
              {e.cover_image ? (
                <img
                  src={e.cover_image.url_thumb}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <span className="h-12 w-12 shrink-0 rounded-sm bg-well/60" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-stock">{e.title}</span>
                <span className="block text-xs text-stock/40">
                  {e.art_date}
                  {e.tags.length > 0 && ` · ${e.tags.map((t) => t.name).join(", ")}`}
                </span>
              </span>
              <span className="shrink-0 text-xs text-stock/30">edit</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
