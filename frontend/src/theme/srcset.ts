/** Working out how wide each derivative actually is.
 *
 *  The backend caps derivatives on the LONG edge -- thumb 400, medium 1400 --
 *  so a portrait photo's thumb is only 225px wide, not 400. A gallery card is
 *  around 450 CSS px, which is ~900 device pixels on a retina screen, so the
 *  thumb alone gets stretched about 4x and looks soft.
 *
 *  Giving the browser both derivatives with their true widths lets it choose:
 *  phones still fetch the 2 KB thumb, desktops fetch the sharp one.
 */

const THUMB_MAX = 400;
const MEDIUM_MAX = 1400;

/** Width of a derivative, given the original's dimensions. Mirrors the
 *  server's resize, which never upscales. */
function derivativeWidth(width: number, height: number, maxEdge: number): number {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return Math.round(width * scale);
}

export function buildSrcSet(image: {
  url_thumb: string;
  url_medium: string;
  width: number;
  height: number;
}): string {
  const t = derivativeWidth(image.width, image.height, THUMB_MAX);
  const m = derivativeWidth(image.width, image.height, MEDIUM_MAX);
  // If the original was small enough that both derivatives came out the same
  // size, offering two identical candidates just confuses the picker.
  if (m <= t) return `${image.url_thumb} ${t}w`;
  return `${image.url_thumb} ${t}w, ${image.url_medium} ${m}w`;
}

/** How wide a gallery card is at each breakpoint, matching the masonry's
 *  1 / 2 / 3 / 4 column layout. Without this the browser assumes 100vw and
 *  always fetches the largest candidate. */
export const GALLERY_SIZES =
  "(min-width: 1536px) 23vw, (min-width: 1024px) 31vw, (min-width: 640px) 47vw, 92vw";
