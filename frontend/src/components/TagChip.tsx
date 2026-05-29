import { accentFor } from "../theme/rotation";

/** Tailwind cannot see a class name built at runtime, so the variants are
 *  written out in full here for the compiler to find. */
const STYLES = {
  amber: {
    on: "bg-accent-amber text-canvas border-accent-amber",
    off: "text-accent-amber/85 border-accent-amber/35 hover:border-accent-amber/70",
  },
  rust: {
    on: "bg-accent-rust text-canvas border-accent-rust",
    off: "text-accent-rust/85 border-accent-rust/35 hover:border-accent-rust/70",
  },
  teal: {
    on: "bg-accent-teal text-canvas border-accent-teal",
    off: "text-accent-teal/85 border-accent-teal/35 hover:border-accent-teal/70",
  },
} as const;

interface Props {
  slug: string;
  name: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export default function TagChip({ slug, name, count, active = false, onClick }: Props) {
  const style = STYLES[accentFor(slug)];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active ? style.on : style.off
      }`}
    >
      {name}
      {count !== undefined && <span className="ml-1.5 opacity-60">{count}</span>}
    </button>
  );
}
