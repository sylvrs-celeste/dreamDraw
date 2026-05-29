import TagChip from "./TagChip";
import type { TagWithCount } from "../api/types";

interface Props {
  tags: TagWithCount[];
  active: string | null;
  onChange: (slug: string | null) => void;
}

export default function TagFilter({ tags, active, onChange }: Props) {
  // Orphans are deleted server-side, but guard anyway: a zero-count chip is a
  // button that leads to an empty gallery.
  const usable = tags.filter((t) => t.entry_count > 0);
  if (usable.length === 0) return null;

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={active === null}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          active === null
            ? "border-stock/70 bg-stock/90 text-canvas"
            : "border-stock/25 text-stock/60 hover:border-stock/50"
        }`}
      >
        All
      </button>
      {usable.map((tag) => (
        <TagChip
          key={tag.id}
          slug={tag.slug}
          name={tag.name}
          count={tag.entry_count}
          active={active === tag.slug}
          onClick={() => onChange(active === tag.slug ? null : tag.slug)}
        />
      ))}
    </div>
  );
}
