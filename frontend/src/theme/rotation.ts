/** Stable pseudo-random tilt for a polaroid.
 *
 *  Hashed from the entry id rather than Math.random(), so a card keeps the
 *  same angle across re-renders and reloads. Random-at-render means every
 *  card re-tilts whenever anything changes -- filtering, scrolling, a refetch
 *  -- and it reads as a rendering bug rather than as charm.
 */

const MAX_DEGREES = 3.5;

/** FNV-1a. Small, no dependencies, and spreads adjacent uuids apart well
 *  enough that neighbouring cards do not all lean the same way. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function rotationFor(id: string): number {
  // 0..1 -> -1..1 -> degrees, rounded so we don't emit 17 decimal places.
  const unit = (hash(id) % 10000) / 10000;
  return Math.round((unit * 2 - 1) * MAX_DEGREES * 100) / 100;
}

/** Accent colour per tag, hashed off the slug so a tag looks the same
 *  everywhere it appears without storing a colour on the row. */
const ACCENTS = ["amber", "rust", "teal"] as const;
export type Accent = (typeof ACCENTS)[number];

export function accentFor(slug: string): Accent {
  return ACCENTS[hash(slug) % ACCENTS.length];
}
